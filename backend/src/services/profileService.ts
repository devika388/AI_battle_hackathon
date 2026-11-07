import type { AppRole } from "../types/auth.js";
import { HttpError } from "../utils/HttpError.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { failDatabase, getOwnedProfileId } from "./domainCommon.js";
import type { z } from "zod";
import { profileUpdateSchema } from "../validators/domainSchemas.js";
import { getAuthProfile } from "./authService.js";

type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export async function getUserProfile(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, is_suspended")
    .eq("id", userId)
    .maybeSingle();
  if (error) failDatabase(error, "Could not load user profile:");
  if (!profile) return null;

  const role = profile.role as AppRole;
  const result: Record<string, unknown> = {
    ...profile,
    is_approved: role === "donor" || role === "admin" || role === "delivery_partner",
  };
  if (role === "donor") {
    const id = await getOwnedProfileId("donor_profiles", userId);
    const { data, error: detailError } = await supabase
      .from("donor_profiles")
      .select("organization_name, address, city")
      .eq("id", id)
      .single();
    if (detailError) failDatabase(detailError, "Could not load donor profile details:");
    result.donor = data;
  } else if (role === "ngo") {
    const { data, error: detailError } = await supabase
      .from("ngo_profiles")
      .select("organization_name, registration_number, address, city, is_verified")
      .eq("user_id", userId)
      .maybeSingle();
    if (detailError) failDatabase(detailError, "Could not load NGO profile details:");
    result.ngo = data;
    result.is_approved = data?.is_verified === true;
  } else if (role === "delivery_partner" || role === "delivery_partner_pending") {
    const { data, error: detailError } = await supabase
      .from("partner_profiles")
      .select("vehicle_type, vehicle_number, availability")
      .eq("user_id", userId)
      .maybeSingle();
    if (detailError) failDatabase(detailError, "Could not load partner profile details:");
    result.partner = data;
  }
  return result;
}

export async function updateUserProfile(userId: string, input: ProfileUpdate) {
  const supabase = getSupabaseAdmin();
  const profile = await getAuthProfile(userId);
  if (!profile) throw new HttpError("User profile not found.", 404);

  const profileFields = {
    ...(input.full_name !== undefined ? { full_name: input.full_name } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
  };
  const subtypeFields = {
    ...(input.organization_name !== undefined
      ? { organization_name: input.organization_name }
      : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.vehicle_type !== undefined ? { vehicle_type: input.vehicle_type } : {}),
    ...(input.vehicle_number !== undefined
      ? { vehicle_number: input.vehicle_number }
      : {}),
    ...(input.availability !== undefined
      ? { availability: input.availability }
      : {}),
  };

  if (Object.keys(subtypeFields).length > 0) {
    let table: "donor_profiles" | "ngo_profiles" | "partner_profiles";
    let allowedFields: string[];
    if (profile.role === "donor") {
      table = "donor_profiles";
      allowedFields = ["organization_name", "address", "city"];
    } else if (profile.role === "ngo") {
      table = "ngo_profiles";
      allowedFields = ["organization_name", "address", "city"];
    } else if (
      profile.role === "delivery_partner" ||
      profile.role === "delivery_partner_pending"
    ) {
      table = "partner_profiles";
      allowedFields = ["vehicle_type", "vehicle_number", "availability"];
    } else {
      throw new HttpError("This account has no editable organization profile.", 403);
    }

    const invalidFields = Object.keys(subtypeFields).filter(
      (field) => !allowedFields.includes(field),
    );
    if (invalidFields.length) {
      throw new HttpError(
        `These profile fields are not editable for your role: ${invalidFields.join(", ")}.`,
        400,
      );
    }
    if (
      profile.role === "delivery_partner_pending" &&
      "availability" in subtypeFields
    ) {
      throw new HttpError("Partner availability can be changed after approval.", 403);
    }
    const profileId = await getOwnedProfileId(table, userId);
    const { error: detailError } = await supabase
      .from(table)
      .update(subtypeFields)
      .eq("id", profileId);
    if (detailError) failDatabase(detailError, "Could not update role profile:");
  }

  if (Object.keys(profileFields).length === 0) {
    return getUserProfile(userId);
  }
  const { data, error } = await supabase
    .from("profiles")
    .update(profileFields)
    .eq("id", userId)
    .select("id, full_name, email, phone, role")
    .maybeSingle();
  if (error) failDatabase(error, "Could not update user profile:");
  if (!data) throw new HttpError("User profile not found.", 404);
  return data;
}
