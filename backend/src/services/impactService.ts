import type { AppRole } from "../types/auth.js";
import { HttpError } from "../utils/HttpError.js";
import { failDatabase } from "./domainCommon.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";

export async function getImpactStatistics(
  userId: string,
  role: AppRole,
  allAccounts = false,
) {
  if (!allAccounts && !["donor", "ngo", "delivery_partner"].includes(role)) {
    throw new HttpError("Impact statistics are not available for this role.", 403);
  }
  const { data, error } = await getSupabaseAdmin().rpc(
    "foodbridge_impact_totals",
    { p_user_id: userId },
  );
  if (error) failDatabase(error, "Could not calculate impact statistics:");
  const totals = Array.isArray(data) ? data[0] : data;
  return {
    donations: Number(totals?.donations ?? 0),
    food_saved_kg: Number(totals?.food_saved_kg ?? 0),
    meals_provided: Number(totals?.meals_provided ?? 0),
    co2_saved_kg: Number(totals?.co2_saved_kg ?? 0),
  };
}
