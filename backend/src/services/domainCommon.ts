import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { getAuthProfile } from "./authService.js";
import { HttpError } from "../utils/HttpError.js";

export function failDatabase(error: unknown, message: string): never {
  console.error(message, error);
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;
  if (code === "42703") {
    throw new HttpError(
      "The Supabase database is missing a required column. Apply the pending FoodBridge migrations in timestamp order, then retry.",
      500,
    );
  }
  if (code === "PGRST202" || code === "42883") {
    throw new HttpError(
      "A required Supabase database function is missing. Apply the pending FoodBridge migrations in timestamp order, then retry.",
      500,
    );
  }
  throw new HttpError("The request could not be completed. Please try again.", 500);
}

export async function assertActiveUser(userId: string) {
  const profile = await getAuthProfile(userId);
  if (!profile) throw new HttpError("Your account profile was not found.", 403);
  if (profile.is_suspended) throw new HttpError("This account is suspended.", 403);
  return profile;
}

export async function getOwnedProfileId(
  table: "donor_profiles" | "ngo_profiles" | "partner_profiles",
  userId: string,
) {
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .limit(2);
  if (error) failDatabase(error, `Could not load ${table} ownership:`);
  if (!data?.length) throw new HttpError("Your role profile was not found.", 403);
  if (data.length !== 1) {
    console.error(`Multiple ${table} rows found for one account.`);
    throw new HttpError("Your account profile needs administrator review.", 409);
  }
  return data[0].id as string;
}

export async function requireVerifiedNgo(userId: string) {
  await assertActiveUser(userId);
  const { data, error } = await getSupabaseAdmin()
    .from("ngo_profiles")
    .select("id, is_verified")
    .eq("user_id", userId)
    .limit(2);
  if (error) failDatabase(error, "Could not load NGO verification status:");
  if (!data?.length) throw new HttpError("Your NGO profile was not found.", 403);
  if (data.length !== 1) {
    throw new HttpError("Your account profile needs administrator review.", 409);
  }
  if (data[0].is_verified !== true) {
    throw new HttpError("NGO verification is required for this action.", 403);
  }
  return data[0].id as string;
}

export async function requireVerifiedPartner(userId: string) {
  await assertActiveUser(userId);
  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (error) failDatabase(error, "Could not verify delivery partner role:");
  if (data?.role !== "delivery_partner") {
    throw new HttpError("Approved delivery partner access is required.", 403);
  }
  return getOwnedProfileId("partner_profiles", userId);
}
