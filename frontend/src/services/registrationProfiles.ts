import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";

type PublicRole = "donor" | "ngo" | "delivery_partner";
type Registration = Record<string, string> & { role: PublicRole };
const registrationWrites = new Map<string, Promise<void>>();

function isRegistration(value: unknown): value is Registration {
  if (!value || typeof value !== "object") return false;
  const registration = value as Record<string, unknown>;
  if (
    registration.role !== "donor" &&
    registration.role !== "ngo" &&
    registration.role !== "delivery_partner"
  ) {
    return false;
  }
  return Object.values(registration).every(
    (field) => typeof field === "string",
  );
}

export function ensureRegistrationProfiles(
  user: User,
  registrationValue: unknown,
): Promise<void> {
  if (!isRegistration(registrationValue)) return Promise.resolve();
  const pendingWrite = registrationWrites.get(user.id);
  if (pendingWrite) return pendingWrite;

  const write = writeRegistrationProfiles(user, registrationValue);
  const trackedWrite = write.finally(() => {
    if (registrationWrites.get(user.id) === trackedWrite) {
      registrationWrites.delete(user.id);
    }
  });
  registrationWrites.set(user.id, trackedWrite);
  return trackedWrite;
}

async function writeRegistrationProfiles(
  user: User,
  registrationValue: Registration,
): Promise<void> {
  if (!user.email) throw new Error("Your account does not have an email address.");

  const supabase = getSupabaseClient();
  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const profileRoleMatches =
    existingProfile?.role === registrationValue.role ||
    (registrationValue.role === "delivery_partner" &&
      existingProfile?.role === "delivery_partner_pending");
  if (existingProfile && !profileRoleMatches) {
    return;
  }

  if (!existingProfile) {
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: registrationValue.full_name,
      email: user.email,
      phone: registrationValue.phone,
      role: registrationValue.role,
    });
    if (error) throw error;
  }

  if (registrationValue.role === "donor") {
    const { data, error } = await supabase
      .from("donor_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .limit(2);
    if (error) throw error;
    if (data.length > 1) {
      throw new Error("Your donor profile needs administrator review.");
    }
    if (data.length === 0) {
      const { error: insertError } = await supabase.from("donor_profiles").insert({
        user_id: user.id,
        organization_name: registrationValue.organization_name,
        address: registrationValue.address,
        city: registrationValue.city,
      });
      if (insertError) throw insertError;
    }
  } else if (registrationValue.role === "ngo") {
    const { data, error } = await supabase
      .from("ngo_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .limit(2);
    if (error) throw error;
    if (data.length > 1) {
      throw new Error("Your NGO profile needs administrator review.");
    }
    if (data.length === 0) {
      const { error: insertError } = await supabase.from("ngo_profiles").insert({
        user_id: user.id,
        organization_name: registrationValue.organization_name,
        registration_number: registrationValue.registration_number,
        address: registrationValue.address,
        city: registrationValue.city,
        is_verified: true,
        verification_status: "approved",
      });
      if (insertError) throw insertError;
    }
  } else {
    const { data, error } = await supabase
      .from("partner_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .limit(2);
    if (error) throw error;
    if (data.length > 1) {
      throw new Error("Your delivery partner profile needs administrator review.");
    }
    if (data.length === 0) {
      const { error: insertError } = await supabase.from("partner_profiles").insert({
        user_id: user.id,
        vehicle_type: registrationValue.vehicle_type,
        vehicle_number: registrationValue.vehicle_number,
        availability: false,
        verification_status:
          existingProfile?.role === "delivery_partner_pending"
            ? "pending"
            : "approved",
      });
      if (insertError) throw insertError;
    }
  }
}
