import type { z } from "zod";
import { rescueUpdateSchema } from "../validators/domainSchemas.js";
import { HttpError } from "../utils/HttpError.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { failDatabase } from "./domainCommon.js";
import { approveRegistration } from "./authService.js";

type RescueUpdate = z.infer<typeof rescueUpdateSchema>;

export async function listUsers(limit: number, offset: number) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, is_suspended")
    .order("full_name", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load users:");
  const users = data ?? [];
  const ids = users.map((user) => user.id);
  if (!ids.length) return [];
  const [donors, ngos, partners] = await Promise.all([
    supabase.from("donor_profiles").select("user_id, organization_name, city").in("user_id", ids),
    supabase.from("ngo_profiles").select("user_id, organization_name, city, is_verified, verification_status, verification_notes").in("user_id", ids),
    supabase.from("partner_profiles").select("id, user_id, vehicle_type, vehicle_number, availability, verification_status, verification_notes").in("user_id", ids),
  ]);
  if (donors.error) failDatabase(donors.error, "Could not load donor details:");
  if (ngos.error) failDatabase(ngos.error, "Could not load NGO details:");
  if (partners.error) failDatabase(partners.error, "Could not load delivery partner details:");
  const donorByUser = new Map((donors.data ?? []).map((item) => [item.user_id, item]));
  const ngoByUser = new Map((ngos.data ?? []).map((item) => [item.user_id, item]));
  const partnerByUser = new Map((partners.data ?? []).map((item) => [item.user_id, item]));
  return users.map((user) => ({
    ...user,
    donor: donorByUser.get(user.id) ?? null,
    ngo: ngoByUser.get(user.id) ?? null,
    partner: partnerByUser.get(user.id) ?? null,
  }));
}

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function loadAllRows<T>(
  readPage: (start: number, end: number) => PromiseLike<PageResult<T>>,
  context: string,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await readPage(offset, offset + 999);
    if (error) failDatabase(error, context);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

export async function getAdminDashboardReport() {
  const supabase = getSupabaseAdmin();
  const [profiles, donations, ngos, partners, assignments, requests, impacts] = await Promise.all([
    loadAllRows((start, end) => supabase.from("profiles").select("id, role, is_suspended, full_name").range(start, end), "Could not build user reports:"),
    loadAllRows((start, end) => supabase.from("donations").select("id, created_at, status, food_category").range(start, end), "Could not build donation reports:"),
    loadAllRows((start, end) => supabase.from("ngo_profiles").select("id, user_id, organization_name, is_verified").range(start, end), "Could not build NGO reports:"),
    loadAllRows((start, end) => supabase.from("partner_profiles").select("id, user_id, vehicle_type").range(start, end), "Could not build partner reports:"),
    loadAllRows((start, end) => supabase.from("donation_assignments").select("id, ngo_id, partner_id, status").range(start, end), "Could not build assignment reports:"),
    loadAllRows((start, end) => supabase.from("rescue_requests").select("id, status, created_at").range(start, end), "Could not build rescue request reports:"),
    loadAllRows((start, end) => supabase.from("impact_records").select("donation_id, food_saved_kg, meals_provided").range(start, end), "Could not build impact reports:"),
  ]);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const sumField = (field: "food_saved_kg" | "meals_provided") =>
    impacts.reduce((sum, item) => sum + Number(item[field] ?? 0), 0);
  const days = new Map<string, number>();
  const categories = new Map<string, number>();
  const donationDateById = new Map(donations.map((donation) => [donation.id, donation.created_at.slice(0, 10)]));
  const impactByDay = new Map<string, { food_saved_kg: number; meals_provided: number }>();
  for (const donation of donations) {
    const day = donation.created_at.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
    categories.set(donation.food_category, (categories.get(donation.food_category) ?? 0) + 1);
  }
  for (const impact of impacts) {
    const date = donationDateById.get(impact.donation_id);
    if (!date) continue;
    const totals = impactByDay.get(date) ?? { food_saved_kg: 0, meals_provided: 0 };
    totals.food_saved_kg += Number(impact.food_saved_kg ?? 0);
    totals.meals_provided += Number(impact.meals_provided ?? 0);
    impactByDay.set(date, totals);
  }
  const ngoCounts = new Map<string, { name: string; assigned: number; completed: number }>();
  const partnerCounts = new Map<string, { name: string; assigned: number; completed: number }>();
  const ngoById = new Map(ngos.map((ngo) => [ngo.id, ngo]));
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  for (const assignment of assignments) {
    if (assignment.ngo_id) {
      const ngo = ngoById.get(assignment.ngo_id);
      if (ngo) {
        const stats = ngoCounts.get(ngo.id) ?? { name: ngo.organization_name ?? "NGO", assigned: 0, completed: 0 };
        stats.assigned += 1;
        if (assignment.status === "completed") stats.completed += 1;
        ngoCounts.set(ngo.id, stats);
      }
    }
    if (assignment.partner_id) {
      const partner = partnerById.get(assignment.partner_id);
      const partnerProfile = partner ? profilesById.get(partner.user_id) : null;
      if (partner) {
        const stats = partnerCounts.get(partner.id) ?? { name: partnerProfile?.full_name ?? "Delivery partner", assigned: 0, completed: 0 };
        stats.assigned += 1;
        if (assignment.status === "completed") stats.completed += 1;
        partnerCounts.set(partner.id, stats);
      }
    }
  }
  const successfulRescues = assignments.filter((item) => item.status === "completed").length;
  return {
    summary: {
      total_users: profiles.length,
      total_donations: donations.length,
      active_ngos: ngos.filter((item) => item.is_verified && profilesById.get(item.user_id)?.role === "ngo" && !profilesById.get(item.user_id)?.is_suspended).length,
      active_partners: partners.filter((item) => profilesById.get(item.user_id)?.role === "delivery_partner" && !profilesById.get(item.user_id)?.is_suspended).length,
      successful_rescues: successfulRescues,
      pending_requests: requests.filter((item) => item.status === "open").length,
      food_saved_kg: sumField("food_saved_kg"),
      meals_provided: sumField("meals_provided"),
    },
    donations_over_time: [...days].sort(([left], [right]) => left.localeCompare(right)).map(([date, donations_count]) => ({ date, donations: donations_count })),
    impact_over_time: [...impactByDay].sort(([left], [right]) => left.localeCompare(right)).map(([date, totals]) => ({ date, ...totals })),
    food_categories: [...categories].map(([category, donations_count]) => ({ category, donations: donations_count })),
    ngo_performance: [...ngoCounts.values()].sort((left, right) => right.completed - left.completed),
    delivery_performance: [...partnerCounts.values()].sort((left, right) => right.completed - left.completed),
  };
}

export async function rejectVerification(
  userId: string,
  kind: "ngo" | "partner",
  reason: string,
) {
  const supabase = getSupabaseAdmin();
  if (kind === "ngo") {
    const { data, error } = await supabase
      .from("ngo_profiles")
      .update({ verification_status: "rejected", verification_notes: reason, is_verified: false })
      .eq("user_id", userId)
      .eq("is_verified", false)
      .select("user_id")
      .maybeSingle();
    if (error) failDatabase(error, "Could not reject NGO verification:");
    if (!data) throw new HttpError("NGO not found or already approved.", 409);
    return { user_id: userId, verification_status: "rejected" };
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) failDatabase(profileError, "Could not verify partner account:");
  if (profile?.role !== "delivery_partner_pending") {
    throw new HttpError("Only pending delivery partners can be rejected.", 409);
  }
  const { data, error } = await supabase
    .from("partner_profiles")
    .update({ verification_status: "rejected", verification_notes: reason })
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (error) failDatabase(error, "Could not reject delivery partner verification:");
  if (!data) throw new HttpError("Delivery partner profile not found.", 404);
  return { user_id: userId, verification_status: "rejected" };
}

export async function setAccountSuspension(
  adminUserId: string,
  targetUserId: string,
  suspended: boolean,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "foodbridge_set_account_suspension",
    {
      p_admin_user_id: adminUserId,
      p_target_user_id: targetUserId,
      p_is_suspended: suspended,
    },
  );
  if (error) {
    if (error.code === "P0002") throw new HttpError("User not found.", 404);
    if (error.code === "55000") throw new HttpError(error.message, 409);
    failDatabase(error, "Could not update account suspension:");
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new HttpError("User not found.", 404);
  return {
    id: result.user_id,
    role: result.role,
    is_suspended: result.is_suspended,
  };
}

export async function verifyNgo(userId: string) {
  await approveRegistration(userId);
  return { user_id: userId, verified: true };
}

export async function verifyDeliveryPartner(userId: string) {
  await approveRegistration(userId);
  return { user_id: userId, verified: true };
}

export async function monitorDonations(limit: number, offset: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("donations")
    .select("*, donor_profiles!inner(user_id, organization_name)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load donation monitoring data:");
  return data ?? [];
}

export async function monitorAssignments(limit: number, offset: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("donation_assignments")
    .select("*, donations!inner(food_name, status, expiry_time), ngo_profiles(organization_name), partner_profiles(vehicle_type, vehicle_number)")
    .order("assigned_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load assignment monitoring data:");
  return data ?? [];
}

export async function listRescueRequests(limit: number, offset: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("rescue_requests")
    .select("*, donations(food_name, status, donor_id)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load rescue requests:");
  return data ?? [];
}

export async function updateRescueRequest(
  rescueId: string,
  input: RescueUpdate,
) {
  if (input.status === "assigned" && !input.assigned_partner_id) {
    throw new HttpError("Choose an approved delivery partner to assign.", 400);
  }
  if (input.status !== "assigned" && input.assigned_partner_id) {
    throw new HttpError("A delivery partner can only be set for an assigned request.", 400);
  }
  if (input.assigned_partner_id) {
    const { data: partner, error: partnerError } = await getSupabaseAdmin()
      .from("partner_profiles")
      .select("id, user_id")
      .eq("id", input.assigned_partner_id)
      .maybeSingle();
    if (partnerError) {
      failDatabase(partnerError, "Could not verify assigned delivery partner:");
    }
    if (!partner) throw new HttpError("Delivery partner not found.", 404);
    const { data: profile, error: profileError } = await getSupabaseAdmin()
      .from("profiles")
      .select("id")
      .eq("id", partner.user_id)
      .eq("role", "delivery_partner")
      .eq("is_suspended", false)
      .maybeSingle();
    if (profileError) {
      failDatabase(profileError, "Could not verify delivery partner approval:");
    }
    if (!profile) {
      throw new HttpError("Only active, approved delivery partners can be assigned.", 409);
    }
  }
  const { data, error } = await getSupabaseAdmin()
    .from("rescue_requests")
    .update(input)
    .eq("id", rescueId)
    .select("*")
    .maybeSingle();
  if (error) failDatabase(error, "Could not update rescue request:");
  if (!data) throw new HttpError("Rescue request not found.", 404);
  return data;
}
