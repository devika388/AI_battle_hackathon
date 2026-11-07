import type { z } from "zod";
import { rescueUpdateSchema } from "../validators/domainSchemas.js";
import { HttpError } from "../utils/HttpError.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { failDatabase } from "./domainCommon.js";
import { approveRegistration } from "./authService.js";

type RescueUpdate = z.infer<typeof rescueUpdateSchema>;

export async function listUsers(limit: number, offset: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("id, full_name, email, phone, role, is_suspended")
    .order("full_name", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load users:");
  return data ?? [];
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
    .select("*, donations!inner(food_name, status, expiry_time)")
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
