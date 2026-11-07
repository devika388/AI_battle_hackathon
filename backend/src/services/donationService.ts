import type { z } from "zod";
import type { AppRole } from "../types/auth.js";
import {
  donationCreateSchema,
  donationUpdateSchema,
} from "../validators/domainSchemas.js";
import { HttpError } from "../utils/HttpError.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";
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
      p_expiry_time: input.expiry_time.toISOString(),
      p_image_url: input.image_url ?? null,
    },
  );
  if (error) failDatabase(error, "Could not create donation:");
  return Array.isArray(data) ? data[0] : data;
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
    .gt("expiry_time", new Date().toISOString())
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
    .select("status, description, updated_at")
    .eq("donation_id", donationId)
    .order("updated_at", { ascending: true });
  if (eventsError) failDatabase(eventsError, "Could not load donation history:");
  return { ...data, status_events: events ?? [] };
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
  const { data, error } = await getSupabaseAdmin()
    .from("donations")
    .select("*")
    .eq("donor_id", donorId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load donation history:");
  return data ?? [];
}

export async function listMatchingDonations(
  userId: string,
  limit: number,
  offset: number,
) {
  const ngoId = await requireVerifiedNgo(userId);
  const { data, error } = await getSupabaseAdmin()
    .from("ngo_matches")
    .select(
      "id, donation_id, match_score, match_reason, status, donations!inner(*)",
    )
    .eq("ngo_id", ngoId)
    .eq("status", "pending")
    .eq("donations.status", "available")
    .gt("donations.expiry_time", new Date().toISOString())
    .order("match_score", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load matching donations:");
  return data ?? [];
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
  const { data, error } = await getSupabaseAdmin()
    .from("ngo_matches")
    .update({ status: "declined" })
    .eq("donation_id", donationId)
    .eq("ngo_id", ngoId)
    .eq("status", "pending")
    .select("id, donation_id, status")
    .maybeSingle();
  if (error) failDatabase(error, "Could not decline donation match:");
  if (!data) {
    throw new HttpError("Pending match not found or already handled.", 409);
  }
  return data;
}

export async function listAcceptedDonations(
  userId: string,
  limit: number,
  offset: number,
) {
  const ngoId = await getOwnedProfileId("ngo_profiles", userId);
  const { data, error } = await getSupabaseAdmin()
    .from("donation_assignments")
    .select("*, donations(*)")
    .eq("ngo_id", ngoId)
    .in("status", ["accepted", "assigned", "picked_up", "delivered"])
    .order("assigned_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load accepted donations:");
  return data ?? [];
}
