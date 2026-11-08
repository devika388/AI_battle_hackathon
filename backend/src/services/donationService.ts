import type { z } from "zod";
import type { AppRole } from "../types/auth.js";
import {
  donationCreateSchema,
  donationUpdateSchema,
} from "../validators/domainSchemas.js";
import { HttpError } from "../utils/HttpError.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { recordDonationEvent } from "./foodPassportService.js";
import {
  failDatabase,
  getOwnedProfileId,
  requireVerifiedNgo,
} from "./domainCommon.js";

type DonationCreate = z.infer<typeof donationCreateSchema>;
type DonationUpdate = z.infer<typeof donationUpdateSchema>;

export async function createDonation(userId: string, input: DonationCreate) {
  const donorId = await getOwnedProfileId("donor_profiles", userId);
  const { data, error } = await getSupabaseAdmin().rpc(
    "foodbridge_create_donation",
    {
      p_donor_id: donorId,
      p_food_name: input.food_name,
      p_description: input.description,
      p_food_category: input.food_category,
      p_quantity: input.quantity,
      p_quantity_unit: input.quantity_unit,
      p_pickup_address: input.pickup_address,
      p_city: input.city,
      p_pincode: input.pincode,
      p_preparation_time: input.preparation_time.toISOString(),
      p_expiry_time: input.expiry_time.toISOString(),
      p_image_url: input.image_url ?? null,
    },
  );
  if (error) failDatabase(error, "Could not create donation:");
  const donation = Array.isArray(data) ? data[0] : data;
  await recordDonationEvent({
    donationId: donation.id,
    status: "ngo_matching_started",
    description: "NGO matching started using the donor-provided food and handling details.",
    responsibleUserId: userId,
    location: `${input.pickup_address}, ${input.city}`,
  });
  return donation;
}

export async function listEligibleDonations(
  userId: string,
  limit: number,
  offset: number,
) {
  await requireVerifiedNgo(userId);
  const { data, error } = await getSupabaseAdmin()
    .from("donations")
    .select("*")
    .eq("status", "available")
    .gt("expiry_time", new Date(Date.now() + 2 * 60 * 60_000).toISOString())
    .lte("preparation_time", new Date().toISOString())
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load eligible donations:");
  return data ?? [];
}

async function donationIsVisibleToUser(
  donationId: string,
  userId: string,
  role: AppRole,
) {
  const supabase = getSupabaseAdmin();
  if (role === "admin") return true;
  if (role === "donor") {
    const donorId = await getOwnedProfileId("donor_profiles", userId);
    const { data, error } = await supabase
      .from("donations")
      .select("id")
      .eq("id", donationId)
      .eq("donor_id", donorId)
      .maybeSingle();
    if (error) failDatabase(error, "Could not verify donation ownership:");
    return Boolean(data);
  }
  if (role === "ngo") {
    const ngoId = await requireVerifiedNgo(userId);
    const { data: donation, error } = await supabase
      .from("donations")
      .select("id, status, expiry_time")
      .eq("id", donationId)
      .maybeSingle();
    if (error) failDatabase(error, "Could not load donation:");
    if (!donation) return false;
    if (
      donation.status === "available" &&
      new Date(donation.expiry_time).getTime() > Date.now()
    ) {
      return true;
    }
    const { data: assignment, error: assignmentError } = await supabase
      .from("donation_assignments")
      .select("id")
      .eq("donation_id", donationId)
      .eq("ngo_id", ngoId)
      .maybeSingle();
    if (assignmentError) {
      failDatabase(assignmentError, "Could not verify NGO donation access:");
    }
    return Boolean(assignment);
  }
  if (role === "delivery_partner") {
    const partnerId = await getOwnedProfileId("partner_profiles", userId);
    const { data, error } = await supabase
      .from("donation_assignments")
      .select("id")
      .eq("donation_id", donationId)
      .eq("partner_id", partnerId)
      .maybeSingle();
    if (error) failDatabase(error, "Could not verify delivery assignment access:");
    return Boolean(data);
  }
  return false;
}

export async function getDonation(
  donationId: string,
  userId: string,
  role: AppRole,
) {
  const visible = await donationIsVisibleToUser(donationId, userId, role);
  if (!visible) throw new HttpError("Donation not found.", 404);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("donations")
    .select("*")
    .eq("id", donationId)
    .maybeSingle();
  if (error) failDatabase(error, "Could not load donation:");
  if (!data) throw new HttpError("Donation not found.", 404);
  const { data: events, error: eventsError } = await supabase
    .from("status_events")
    .select("status, description, updated_at, responsible_user_id, location")
    .eq("donation_id", donationId)
    .order("updated_at", { ascending: true });
  if (eventsError) failDatabase(eventsError, "Could not load donation history:");
  const responsibleIds = [...new Set((events ?? [])
    .map((event) => event.responsible_user_id)
    .filter((id): id is string => Boolean(id)))];
  const { data: responsibleUsers, error: responsibleError } = responsibleIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", responsibleIds)
    : { data: [], error: null };
  if (responsibleError) failDatabase(responsibleError, "Could not load timeline participants:");
  const [
    { data: assignments, error: assignmentError },
    { data: matches, error: matchError },
  ] = await Promise.all([
    supabase
      .from("donation_assignments")
      .select(
        "id, donation_id, ngo_id, partner_id, status, assigned_at, ngo_profiles(organization_name), partner_profiles(vehicle_type, vehicle_number)",
      )
      .eq("donation_id", donationId)
      .limit(1),
    supabase
      .from("ngo_matches")
      .select("match_score, match_reason, status, ngo_profiles(organization_name)")
      .eq("donation_id", donationId)
      .order("match_score", { ascending: false }),
  ]);
  if (assignmentError) {
    failDatabase(assignmentError, "Could not load donation assignment:");
  }
  if (matchError) failDatabase(matchError, "Could not load NGO matches:");
  const assignment = assignments?.[0] ?? null;
  const { data: proofs, error: proofError } = assignment
    ? await supabase
        .from("delivery_proofs")
        .select("id, notes, receiver_name, delivered_at")
        .eq("assignment_id", assignment.id)
    : { data: [], error: null };
  if (proofError) failDatabase(proofError, "Could not load delivery proof records:");
  return {
    ...data,
    status_events: (events ?? []).map((event) => ({
      ...event,
      responsible_user: responsibleUsers?.find((user) => user.id === event.responsible_user_id) ?? null,
    })),
    assignment,
    matches: matches ?? [],
    delivery_proofs: proofs ?? [],
  };
}

export async function updateDonation(
  userId: string,
  donationId: string,
  input: DonationUpdate,
) {
  const donorId = await getOwnedProfileId("donor_profiles", userId);
  const update = {
    ...input,
    ...(input.expiry_time
      ? { expiry_time: input.expiry_time.toISOString() }
      : {}),
  };
  const { data, error } = await getSupabaseAdmin()
    .from("donations")
    .update(update)
    .eq("id", donationId)
    .eq("donor_id", donorId)
    .eq("status", "available")
    .select("*")
    .maybeSingle();
  if (error) failDatabase(error, "Could not update donation:");
  if (!data) {
    throw new HttpError(
      "Donation not found, not owned by you, or no longer editable.",
      409,
    );
  }
  return data;
}

export async function cancelDonation(userId: string, donationId: string) {
  const donorId = await getOwnedProfileId("donor_profiles", userId);
  const { data, error } = await getSupabaseAdmin().rpc(
    "foodbridge_cancel_donation",
    { p_donation_id: donationId, p_donor_id: donorId },
  );
  if (error) {
    if (error.code === "55000") {
      throw new HttpError(
        "Only your available donations can be cancelled.",
        409,
      );
    }
    failDatabase(error, "Could not cancel donation:");
  }
  return Array.isArray(data) ? data[0] : data;
}

export async function listDonorDonations(
  userId: string,
  limit: number,
  offset: number,
) {
  const donorId = await getOwnedProfileId("donor_profiles", userId);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("donations")
    .select("*")
    .eq("donor_id", donorId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load donation history:");
  const donations = data ?? [];
  if (!donations.length) return [];
  const ids = donations.map((donation) => donation.id);
  const { data: assignments, error: assignmentError } = await supabase
    .from("donation_assignments")
    .select(
      "donation_id, id, status, assigned_at, ngo_profiles(organization_name), partner_profiles(vehicle_type, vehicle_number)",
    )
    .in("donation_id", ids);
  if (assignmentError) {
    failDatabase(assignmentError, "Could not load donation tracking details:");
  }
  const byDonation = new Map(
    (assignments ?? []).map((assignment) => [assignment.donation_id, assignment]),
  );
  return donations.map((donation) => ({
    ...donation,
    assignment: byDonation.get(donation.id) ?? null,
  }));
}

export async function listMatchingDonations(
  userId: string,
  limit: number,
  offset: number,
) {
  const ngoId = await requireVerifiedNgo(userId);
  const supabase = getSupabaseAdmin();
  const [{ data: ngo, error: ngoError }, { data: donations, error }] =
    await Promise.all([
      supabase
        .from("ngo_profiles")
        .select("city, preferred_categories, max_daily_quantity, capacity_unit")
        .eq("id", ngoId)
        .single(),
      supabase
        .from("ngo_matches")
        .select("donation_id")
        .eq("ngo_id", ngoId)
        .eq("status", "declined"),
    ]);
  if (ngoError) failDatabase(ngoError, "Could not load NGO matching preferences:");
  if (error) failDatabase(error, "Could not load declined NGO matches:");
  const declinedDonationIds = (donations ?? []).map((match) => match.donation_id);
  let availableDonationsQuery = supabase
        .from("donations")
        .select("*")
        .eq("status", "available")
    .gt("expiry_time", new Date(Date.now() + 2 * 60 * 60_000).toISOString())
    .lte("preparation_time", new Date().toISOString())
        .order("created_at", { ascending: false });
  if (declinedDonationIds.length) {
    availableDonationsQuery = availableDonationsQuery.not(
      "id",
      "in",
      `(${declinedDonationIds.join(",")})`,
    );
  }
  const { data: availableDonations, error: availableError } =
    await availableDonationsQuery.range(offset, offset + limit - 1);
  if (availableError) failDatabase(availableError, "Could not load matching donations:");
  const categories = (ngo.preferred_categories ?? []).map((value: string) =>
    value.toLocaleLowerCase().replace(/[\s-]+/g, "_"),
  );
  return (availableDonations ?? [])
    .map((donation) => {
      const components = {
        location: ngo.city && donation.city &&
            ngo.city.trim().toLocaleLowerCase() ===
              donation.city.trim().toLocaleLowerCase()
          ? 35
          : 0,
        food_requirements: categories.length === 0
          ? 15
          : categories.includes(String(donation.food_category).toLocaleLowerCase().replace(/[\s-]+/g, "_"))
            ? 25
            : 0,
        capacity: ngo.max_daily_quantity == null ||
            !ngo.capacity_unit ||
            ngo.capacity_unit.toLocaleLowerCase() !== String(donation.quantity_unit).toLocaleLowerCase()
          ? 15
          : Number(donation.quantity) <= Number(ngo.max_daily_quantity)
            ? 25
            : 0,
        handling_time: (() => {
          const hours =
            (new Date(donation.expiry_time).getTime() - Date.now()) / 3_600_000;
          return hours >= 4 ? 15 : hours >= 2 ? 8 : 0;
        })(),
      };
      return {
        donation,
        match_score: Object.values(components).reduce((sum, score) => sum + score, 0),
        match_reason: [
          components.location ? "Same city (+35)" : "Different or unknown city (+0)",
          categories.length === 0
            ? "No category preferences set; neutral (+15)"
            : components.food_requirements
              ? "Matches preferred food category (+25)"
              : "Does not match preferred categories (+0)",
          ngo.max_daily_quantity == null
            ? "No daily capacity limit set; neutral (+15)"
            : !ngo.capacity_unit ||
                ngo.capacity_unit.toLocaleLowerCase() !== String(donation.quantity_unit).toLocaleLowerCase()
              ? "Capacity unit differs or is unset; neutral (+15)"
            : components.capacity
              ? "Within daily capacity (+25)"
              : "Exceeds daily capacity (+0)",
          components.handling_time === 15
            ? "At least 4 hours to expiry (+15)"
            : components.handling_time === 8
              ? "2–4 hours to expiry (+8)"
              : "Less than 2 hours to expiry (+0)",
        ].join(" · "),
        score_components: components,
        distance_km: null,
      };
    })
    .sort((left, right) => right.match_score - left.match_score);
}

export async function acceptDonation(userId: string, donationId: string) {
  const ngoId = await requireVerifiedNgo(userId);
  const { data, error } = await getSupabaseAdmin().rpc(
    "foodbridge_accept_donation",
    { p_donation_id: donationId, p_ngo_id: ngoId },
  );
  if (error) {
    if (error.code === "P0002") throw new HttpError("Donation not found.", 404);
    if (error.code === "23505" || error.code === "55000") {
      throw new HttpError("This donation is no longer available.", 409);
    }
    failDatabase(error, "Could not accept donation:");
  }
  return Array.isArray(data) ? data[0] : data;
}

export async function declineDonation(userId: string, donationId: string) {
  const ngoId = await requireVerifiedNgo(userId);
  const { data, error } = await getSupabaseAdmin().rpc(
    "foodbridge_decline_donation",
    { p_donation_id: donationId, p_ngo_id: ngoId },
  );
  if (error) {
    if (error.code === "P0002") throw new HttpError("Donation not found.", 404);
    if (error.code === "55000") {
      throw new HttpError("This donation is no longer available.", 409);
    }
    failDatabase(error, "Could not decline donation:");
  }
  return Array.isArray(data) ? data[0] : data;
}

export async function listAcceptedDonations(
  userId: string,
  limit: number,
  offset: number,
) {
  const ngoId = await requireVerifiedNgo(userId);
  const { data, error } = await getSupabaseAdmin()
    .from("donation_assignments")
    .select("*, donations(*)")
    .eq("ngo_id", ngoId)
    .in("status", ["accepted", "assigned", "picked_up", "delivered", "completed"])
    .order("assigned_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load accepted donations:");
  return data ?? [];
}

export async function confirmNgoReceipt(userId: string, assignmentId: string) {
  const ngoId = await requireVerifiedNgo(userId);
  const { data, error } = await getSupabaseAdmin().rpc(
    "foodbridge_confirm_ngo_receipt",
    { p_assignment_id: assignmentId, p_ngo_id: ngoId },
  );
  if (error) {
    if (error.code === "P0002") throw new HttpError("Assignment not found.", 404);
    if (error.code === "55000") throw new HttpError("Only delivered donations can be confirmed.", 409);
    failDatabase(error, "Could not confirm NGO receipt:");
  }
  const result = Array.isArray(data) ? data[0] : data;
  await recordDonationEvent({
    donationId: result.donation_id,
    status: "ngo_confirmed_receipt",
    description: "NGO confirmed receipt of the donation.",
    responsibleUserId: userId,
  });
  const { data: rescueRequests, error: rescueError } = await getSupabaseAdmin()
    .from("rescue_requests")
    .select("id")
    .eq("donation_id", result.donation_id)
    .in("status", ["open", "assigned"]);
  if (rescueError) failDatabase(rescueError, "Could not finalize the community rescue request:");
  if (rescueRequests?.length) {
    const { error: updateError } = await getSupabaseAdmin()
      .from("rescue_requests")
      .update({
        status: "resolved",
        outcome: "rescued",
        resolution_notes: "NGO receipt was confirmed through the delivery workflow.",
      })
      .in("id", rescueRequests.map((item) => item.id));
    if (updateError) failDatabase(updateError, "Could not record completed community rescue:");
  }
  await recordDonationEvent({
    donationId: result.donation_id,
    status: "rescue_completed",
    description: "Rescue completed after NGO receipt confirmation.",
    responsibleUserId: userId,
  });
  return result;
}
