import type { AppRole } from "../types/auth.js";
import { HttpError } from "../utils/HttpError.js";
import { failDatabase } from "./domainCommon.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";

export async function getImpactStatistics(
  userId: string,
  role: AppRole,
  allAccounts = false,
) {
  if (!allAccounts && !["donor", "ngo", "delivery_partner", "admin"].includes(role)) {
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

interface ImpactRecord {
  donation_id: string;
  food_category: string;
  created_at: string;
  confirmed_at: string;
  food_saved_kg: number | string | null;
  meals_provided: number | string | null;
  co2_saved_kg: number | string | null;
  ngo_id: string | null;
}

interface RescueRecord {
  donation_id: string;
  outcome: string | null;
  status: string;
  created_at: string;
}

export async function getImpactDashboard(userId: string, role: AppRole) {
  const supabase = getSupabaseAdmin();
  const [
    { data: impactData, error: impactError },
    { data: rescueData, error: rescueError },
    { data: ngoData, error: ngoError },
  ] = await Promise.all([
    supabase.rpc("foodbridge_impact_report", { p_user_id: userId }),
    supabase.rpc("foodbridge_rescue_report", { p_user_id: userId }),
    supabase.from("ngo_profiles").select("id, user_id").eq("is_verified", true),
  ]);
  if (impactError) failDatabase(impactError, "Could not load confirmed impact records:");
  if (rescueError) failDatabase(rescueError, "Could not load rescue impact records:");
  if (ngoError) failDatabase(ngoError, "Could not load active NGO partners:");
  const records = (impactData ?? []) as ImpactRecord[];
  const rescues = (rescueData ?? []) as RescueRecord[];
  const totals = records.reduce(
    (sum, record) => ({
      food_saved_kg: sum.food_saved_kg + Number(record.food_saved_kg ?? 0),
      meals_provided: sum.meals_provided + Number(record.meals_provided ?? 0),
      co2_saved_kg: sum.co2_saved_kg + Number(record.co2_saved_kg ?? 0),
    }),
    { food_saved_kg: 0, meals_provided: 0, co2_saved_kg: 0 },
  );
  const donations = new Set(records.map((record) => record.donation_id));
  const completedRescues = rescues.filter((record) => record.outcome === "rescued").length;
  const blockedRescues = rescues.filter((record) => record.outcome === "blocked").length;
  const ngoRows = ngoData ?? [];
  const { data: activeProfiles, error: profileError } = ngoRows.length
    ? await supabase
      .from("profiles")
      .select("id")
      .eq("role", "ngo")
      .eq("is_suspended", false)
      .in("id", ngoRows.map((ngo) => ngo.user_id))
    : { data: [], error: null };
  if (profileError) failDatabase(profileError, "Could not verify active NGO partners:");
  const activeNgoIds = new Set(ngoRows
    .filter((ngo) => activeProfiles?.some((profile) => profile.id === ngo.user_id))
    .map((ngo) => ngo.id));
  const activePartnerCount = role === "admin"
    ? activeNgoIds.size
    : new Set(records.map((record) => record.ngo_id)
      .filter((ngoId): ngoId is string => Boolean(ngoId && activeNgoIds.has(ngoId)))).size;

  return {
    totals: {
      donations: donations.size,
      ...totals,
    },
    summary: {
      successful_donations: donations.size,
      completed_deliveries: donations.size,
      active_ngo_partners: activePartnerCount,
      successful_rescues: completedRescues,
      blocked_rescues: blockedRescues,
    },
    records: records.map((record) => ({
      donation_id: record.donation_id,
      food_category: record.food_category,
      created_at: record.created_at,
      confirmed_at: record.confirmed_at,
      food_saved_kg: Number(record.food_saved_kg ?? 0),
      meals_provided: Number(record.meals_provided ?? 0),
      co2_saved_kg: Number(record.co2_saved_kg ?? 0),
    })),
    rescues,
    co2_assumption:
      "CO2 is an estimate reported exactly as stored in impact_records.co2_saved_kg. FoodBridge applies no conversion factor or independent certification.",
  };
}
