import type { z } from "zod";
import { rescueUpdateSchema } from "../validators/domainSchemas.js";
import { HttpError } from "../utils/HttpError.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { failDatabase } from "./domainCommon.js";
import { approveRegistration } from "./authService.js";
import { recordDonationEvent } from "./foodPassportService.js";

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
  const [profiles, donations, ngos, partners, assignments, requests, impacts, receipts] = await Promise.all([
    loadAllRows((start, end) => supabase.from("profiles").select("id, role, is_suspended, full_name").range(start, end), "Could not build user reports:"),
    loadAllRows((start, end) => supabase.from("donations").select("id, created_at, status, food_category").range(start, end), "Could not build donation reports:"),
    loadAllRows((start, end) => supabase.from("ngo_profiles").select("id, user_id, organization_name, is_verified").range(start, end), "Could not build NGO reports:"),
    loadAllRows((start, end) => supabase.from("partner_profiles").select("id, user_id, vehicle_type").range(start, end), "Could not build partner reports:"),
    loadAllRows((start, end) => supabase.from("donation_assignments").select("id, donation_id, ngo_id, partner_id, status").range(start, end), "Could not build assignment reports:"),
    loadAllRows((start, end) => supabase.from("rescue_requests").select("id, status, created_at").range(start, end), "Could not build rescue request reports:"),
    loadAllRows((start, end) => supabase.from("impact_records").select("donation_id, food_saved_kg, meals_provided").range(start, end), "Could not build impact reports:"),
    loadAllRows((start, end) => supabase.from("status_events").select("donation_id").eq("status", "ngo_confirmed_receipt").range(start, end), "Could not verify completed impact records:"),
  ]);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const completedDonationIds = new Set(donations
    .filter((donation) => donation.status === "completed")
    .map((donation) => donation.id));
  const completedAssignmentDonationIds = new Set(assignments
    .filter((assignment) => assignment.status === "completed")
    .map((assignment) => assignment.donation_id));
  const confirmedDonationIds = new Set(receipts.map((event) => event.donation_id));
  const confirmedImpacts = impacts.filter((impact) =>
    completedDonationIds.has(impact.donation_id) &&
    completedAssignmentDonationIds.has(impact.donation_id) &&
    confirmedDonationIds.has(impact.donation_id),
  );
  const sumField = (field: "food_saved_kg" | "meals_provided") =>
    confirmedImpacts.reduce((sum, item) => sum + Number(item[field] ?? 0), 0);
  const days = new Map<string, number>();
  const categories = new Map<string, number>();
  const donationDateById = new Map(donations.map((donation) => [donation.id, donation.created_at.slice(0, 10)]));
  const impactByDay = new Map<string, { food_saved_kg: number; meals_provided: number }>();
  for (const donation of donations) {
    const day = donation.created_at.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
    categories.set(donation.food_category, (categories.get(donation.food_category) ?? 0) + 1);
  }
  for (const impact of confirmedImpacts) {
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
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("rescue_requests")
    .select("*, donations(id, food_name, status, donor_id, expiry_time, preparation_time, city)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load rescue requests:");
  const requests = data ?? [];
  const donationIds = [...new Set(requests.map((request) => request.donation_id))];
  const { data: assignments, error: assignmentError } = donationIds.length
    ? await supabase
      .from("donation_assignments")
      .select("donation_id, id, status, partner_id, partner_profiles(vehicle_type, vehicle_number)")
      .in("donation_id", donationIds)
    : { data: [], error: null };
  if (assignmentError) failDatabase(assignmentError, "Could not load rescue delivery assignments:");
  return requests.map((request) => ({
    ...request,
    donation_assignments: (assignments ?? []).filter((assignment) =>
      assignment.donation_id === request.donation_id,
    ),
  }));
}

const rescueWindowHours = 4;
const minimumHandlingMinutes = 120;
const rescueBatchSize = 3;
const escalationIntervalMinutes = 15;
const reminderIntervalMinutes = 30;
let communityRescueScanInProgress = false;

export async function scanCommunityRescue(scanningUserId?: string) {
  if (communityRescueScanInProgress) {
    throw new HttpError("A Community Rescue scan is already running.", 409);
  }
  communityRescueScanInProgress = true;
  try {
    return await performCommunityRescueScan(scanningUserId);
  } finally {
    communityRescueScanInProgress = false;
  }
}

async function performCommunityRescueScan(scanningUserId?: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const { data: donations, error: donationError } = await supabase
    .from("donations")
    .select("id, food_name, status, food_category, quantity, quantity_unit, city, pickup_address, preparation_time, expiry_time")
    .eq("status", "available")
    .order("expiry_time", { ascending: true })
    .limit(500);
  if (donationError) failDatabase(donationError, "Could not find unaccepted donations:");
  const donationIds = (donations ?? []).map((donation) => donation.id);
  const { data: requests, error: requestError } = donationIds.length
    ? await supabase
      .from("rescue_requests")
      .select("id, donation_id, status, outcome, escalation_level, notified_ngo_ids, last_notified_at, created_at")
      .in("donation_id", donationIds)
      .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (requestError) failDatabase(requestError, "Could not load active rescue requests:");
  const requestByDonation = new Map<string, NonNullable<typeof requests>[number]>();
  for (const request of requests ?? []) {
    if (!requestByDonation.has(request.donation_id)) requestByDonation.set(request.donation_id, request);
  }
  const summary = { examined: 0, opened: 0, notified: 0, expanded: 0, reminded: 0, blocked: 0 };

  for (const donation of donations ?? []) {
    const expiresAt = new Date(donation.expiry_time).getTime();
    const minutesRemaining = (expiresAt - now.getTime()) / 60_000;
    const prepAt = donation.preparation_time ? new Date(donation.preparation_time).getTime() : Number.NaN;
    const existing = requestByDonation.get(donation.id);
    if (existing && ["resolved", "cancelled"].includes(existing.status)) continue;
    if (existing?.status === "assigned") continue;
    if (minutesRemaining > rescueWindowHours * 60 && Number.isFinite(prepAt) && prepAt <= now.getTime()) continue;
    summary.examined += 1;

    const blockedReason = !Number.isFinite(expiresAt) || minutesRemaining <= 0
      ? "Blocked: donor-provided expiry has passed or is invalid. Expired food is never sent for rescue."
      : !Number.isFinite(prepAt) || prepAt > now.getTime()
        ? "Blocked: donor-provided preparation time is missing or still in the future, so handling readiness is uncertain."
        : minutesRemaining <= minimumHandlingMinutes
          ? "Blocked: less than two hours remain before the donor-provided expiry, so the delivery cannot reasonably be completed in time."
          : null;

    if (blockedReason) {
      if (existing) {
        const { error } = await supabase
          .from("rescue_requests")
          .update({ status: "resolved", outcome: "blocked", reason: blockedReason, resolution_notes: blockedReason })
          .eq("id", existing.id);
        if (error) failDatabase(error, "Could not record blocked rescue request:");
      } else {
        const { data, error } = await supabase
          .from("rescue_requests")
          .insert({
            donation_id: donation.id,
            status: "resolved",
            outcome: "blocked",
            reason: blockedReason,
            description: blockedReason,
            resolution_notes: blockedReason,
          })
          .select("id, donation_id, status, outcome, escalation_level, notified_ngo_ids, last_notified_at, created_at")
          .single();
        if (error) failDatabase(error, "Could not create blocked rescue request:");
        requestByDonation.set(donation.id, data);
        summary.opened += 1;
      }
      await recordDonationEvent({
        donationId: donation.id,
        status: "rescue_blocked",
        description: blockedReason,
        responsibleUserId: scanningUserId ?? null,
        location: donation.city ?? donation.pickup_address,
      });
      summary.blocked += 1;
      continue;
    }

    const reason = `No NGO has accepted this donation and the donor-provided expiry is in ${Math.floor(minutesRemaining / 60)}h ${Math.floor(minutesRemaining % 60)}m. FoodBridge coordinates rescue only and does not certify food safety.`;
    let activeRequest = existing;
    if (!activeRequest) {
      const { data, error } = await supabase
        .from("rescue_requests")
        .insert({
          donation_id: donation.id,
          status: "open",
          reason,
          description: reason,
        })
        .select("id, donation_id, status, outcome, escalation_level, notified_ngo_ids, last_notified_at, created_at")
        .single();
      if (error) failDatabase(error, "Could not create rescue request:");
      activeRequest = data;
      requestByDonation.set(donation.id, data);
      summary.opened += 1;
      await recordDonationEvent({
        donationId: donation.id,
        status: "rescue_search_started",
        description: "Community rescue search started because no NGO had accepted before the donor-provided handling window narrowed.",
        responsibleUserId: scanningUserId ?? null,
        location: donation.city ?? donation.pickup_address,
      });
    } else {
      const { error } = await supabase
        .from("rescue_requests")
        .update({ reason, description: reason })
        .eq("id", activeRequest.id);
      if (error) failDatabase(error, "Could not update rescue request reason:");
    }
    if (!activeRequest) throw new Error("Rescue request was not initialized.");

    const { data: ngos, error: ngoError } = await supabase
      .from("ngo_profiles")
      .select("id, user_id, city, preferred_categories, max_daily_quantity, capacity_unit")
      .eq("is_verified", true);
    if (ngoError) failDatabase(ngoError, "Could not find eligible NGOs:");
    const ngoRows = ngos ?? [];
    const { data: activeProfiles, error: profileError } = ngoRows.length
      ? await supabase
        .from("profiles")
        .select("id, role, is_suspended")
        .in("id", ngoRows.map((ngo) => ngo.user_id))
      : { data: [], error: null };
    if (profileError) failDatabase(profileError, "Could not verify eligible NGO accounts:");
    const activeUserIds = new Set((activeProfiles ?? [])
      .filter((profile) => profile.role === "ngo" && !profile.is_suspended)
      .map((profile) => profile.id));
    const category = String(donation.food_category).toLocaleLowerCase().replace(/[\s-]+/g, "_");
    const eligible = ngoRows.filter((ngo) => {
      if (!activeUserIds.has(ngo.user_id)) return false;
      if (!donation.city || !ngo.city || donation.city.trim().toLocaleLowerCase() !== ngo.city.trim().toLocaleLowerCase()) return false;
      const preferred = (ngo.preferred_categories ?? []).map((item: string) => item.toLocaleLowerCase().replace(/[\s-]+/g, "_"));
      if (preferred.length && !preferred.includes(category)) return false;
      if (ngo.max_daily_quantity != null) {
        if (!ngo.capacity_unit || ngo.capacity_unit.toLocaleLowerCase() !== String(donation.quantity_unit).toLocaleLowerCase()) return false;
        if (Number(donation.quantity) > Number(ngo.max_daily_quantity)) return false;
      }
      return true;
    });
    const notifiedIds = new Set<string>(activeRequest.notified_ngo_ids ?? []);
    const freshCandidates = eligible.filter((ngo) => !notifiedIds.has(ngo.id));
    const lastNotified = activeRequest.last_notified_at
      ? new Date(activeRequest.last_notified_at).getTime()
      : 0;
    const cooldownElapsed = now.getTime() - lastNotified >= escalationIntervalMinutes * 60_000;
    let targets = freshCandidates.slice(0, rescueBatchSize);
    let eventStatus = lastNotified ? "rescue_search_expanded" : "rescue_ngo_notified";
    let nextLevel = Number(activeRequest.escalation_level ?? 0);

    if (!targets.length && cooldownElapsed && eligible.length && now.getTime() - lastNotified >= reminderIntervalMinutes * 60_000) {
      targets = eligible;
      eventStatus = "rescue_reminder_sent";
      summary.reminded += 1;
    } else if (targets.length && lastNotified && cooldownElapsed) {
      summary.expanded += 1;
      nextLevel += 1;
    } else if (targets.length && lastNotified && !cooldownElapsed) {
      continue;
    } else if (!targets.length) {
      if (!eligible.length && activeRequest.outcome !== "blocked") {
        const note = "No verified, active NGO in the same city meets the declared food-category and capacity requirements. Transportation feasibility cannot be inferred because no route or partner ETA is recorded.";
        const { error } = await supabase
          .from("rescue_requests")
          .update({ outcome: "blocked", resolution_notes: note })
          .eq("id", activeRequest.id);
        if (error) failDatabase(error, "Could not record rescue feasibility:");
        await recordDonationEvent({
          donationId: donation.id,
          status: "rescue_blocked",
          description: note,
          responsibleUserId: scanningUserId ?? null,
          location: donation.city ?? donation.pickup_address,
        });
        summary.blocked += 1;
      }
      continue;
    }

    const notifications = targets.map((ngo) => ({
      user_id: ngo.user_id,
      title: "Community rescue request",
      message: `FoodBridge is seeking an eligible recipient for ${donation.food_name} (${donation.quantity} ${donation.quantity_unit}) in ${donation.city}. Donor-provided expiry: ${new Date(donation.expiry_time).toLocaleString()}. Review preparation and pickup details before accepting; FoodBridge does not certify food safety. Donation ID: ${donation.id}`,
    }));
    const { error: notificationError } = await supabase.from("notifications").insert(notifications);
    if (notificationError) failDatabase(notificationError, "Could not notify eligible NGOs:");
    const updatedIds = [...new Set([...notifiedIds, ...targets.map((ngo) => ngo.id)])];
    const { error: updateError } = await supabase
      .from("rescue_requests")
      .update({
        notified_ngo_ids: updatedIds,
        last_notified_at: now.toISOString(),
        escalation_level: nextLevel,
        outcome: null,
        resolution_notes: "Notifications sent to verified, same-city NGOs that match the donor-declared category and capacity. A coordinator must verify transport ETA; no assignment or safety certification is inferred.",
      })
      .eq("id", activeRequest.id);
    if (updateError) failDatabase(updateError, "Could not record rescue escalation:");
    await recordDonationEvent({
      donationId: donation.id,
      status: eventStatus,
      description: `${targets.length} eligible same-city NGO${targets.length === 1 ? "" : "s"} notified. No delivery assignment was created; recipient acceptance and transport feasibility remain required.`,
      responsibleUserId: scanningUserId ?? null,
      location: donation.city ?? donation.pickup_address,
    });
    summary.notified += targets.length;
  }
  return summary;
}

export async function updateRescueRequest(
  rescueId: string,
  input: RescueUpdate,
  adminUserId: string,
) {
  const supabase = getSupabaseAdmin();
  const { data: request, error: requestError } = await supabase
    .from("rescue_requests")
    .select("id, donation_id, status, outcome, assigned_partner_id, resolution_notes")
    .eq("id", rescueId)
    .maybeSingle();
  if (requestError) failDatabase(requestError, "Could not load rescue request:");
  if (!request) throw new HttpError("Rescue request not found.", 404);
  if (input.assigned_partner_id) {
    const { data: assignment, error: assignmentError } = await supabase
      .from("donation_assignments")
      .select("id, status, partner_id")
      .eq("donation_id", request.donation_id)
      .eq("partner_id", input.assigned_partner_id)
      .maybeSingle();
    if (assignmentError) failDatabase(assignmentError, "Could not verify rescue assignment:");
    if (!assignment || !["assigned", "picked_up", "delivered", "completed"].includes(assignment.status)) {
      throw new HttpError("A rescue partner can only be recorded after the partner accepts the actual delivery assignment.", 409);
    }
  }
  if (input.status === "assigned" && !input.assigned_partner_id) {
    throw new HttpError("A rescue request can only be marked assigned when the accepted delivery partner is recorded.", 400);
  }
  if (input.status !== "assigned" && input.assigned_partner_id) {
    throw new HttpError("A delivery partner can only be recorded for an assigned rescue request.", 400);
  }
  if (input.status === "resolved") {
    if (!input.outcome) throw new HttpError("Record whether the rescue was completed or blocked.", 400);
    if (!input.resolution_notes?.trim()) {
      throw new HttpError("Record notes explaining the final rescue outcome.", 400);
    }
    if (input.outcome === "rescued") {
      const { data: completedAssignment, error: completedError } = await supabase
        .from("donation_assignments")
        .select("id")
        .eq("donation_id", request.donation_id)
        .eq("status", "completed")
        .maybeSingle();
      if (completedError) failDatabase(completedError, "Could not verify rescue completion:");
      if (!completedAssignment) {
        throw new HttpError("A rescue can only be recorded as completed after NGO receipt is confirmed.", 409);
      }
    }
  } else if (input.outcome) {
    throw new HttpError("Record a final outcome only when resolving the rescue request.", 400);
  }
  const updatedFields = {
    status: input.status,
    assigned_partner_id: input.status === "assigned" ? input.assigned_partner_id ?? null : null,
    outcome: input.status === "resolved" ? input.outcome ?? null : null,
    resolution_notes: input.resolution_notes?.trim() || null,
  };
  const changed = request.status !== updatedFields.status ||
    request.assigned_partner_id !== updatedFields.assigned_partner_id ||
    request.outcome !== updatedFields.outcome ||
    request.resolution_notes !== updatedFields.resolution_notes;
  const { data, error } = await supabase
    .from("rescue_requests")
    .update(updatedFields)
    .eq("id", rescueId)
    .select("*")
    .maybeSingle();
  if (error) failDatabase(error, "Could not update rescue request:");
  if (!data) throw new HttpError("Rescue request not found.", 404);
  if (!changed) return data;
  const eventStatus = input.status === "resolved"
    ? input.outcome === "rescued" ? "rescue_completed" : "rescue_blocked"
    : input.status === "assigned" ? "rescue_assigned" : `rescue_${input.status}`;
  await recordDonationEvent({
    donationId: request.donation_id,
    status: eventStatus,
    description: input.resolution_notes?.trim() || `Administrator updated rescue request to ${input.status}${input.outcome ? ` (${input.outcome})` : ""}.`,
    responsibleUserId: adminUserId,
  });
  return data;
}
