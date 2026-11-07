import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { HttpError } from "../utils/HttpError.js";
import type { AuthProfile, PendingApproval } from "../types/auth.js";

const requiredText = (maximum: number) =>
  z.string().trim().min(1, "This field is required.").max(maximum);
const phoneText = requiredText(40).regex(
  /^\+?[0-9\s().-]{7,20}$/,
  "Enter a valid phone number.",
);

const registrationSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("donor"),
    full_name: requiredText(120),
    phone: phoneText,
    organization_name: requiredText(160),
    donor_type: z.enum(["restaurant", "grocery", "hotel", "caterer", "other"]),
    address: requiredText(500),
    city: requiredText(120),
  }),
  z.object({
    role: z.literal("ngo"),
    full_name: requiredText(120),
    phone: phoneText,
    organization_name: requiredText(160),
    registration_number: requiredText(120),
    address: requiredText(500),
    city: requiredText(120),
  }),
  z.object({
    role: z.literal("delivery_partner"),
    full_name: requiredText(120),
    phone: phoneText,
    vehicle_type: requiredText(80),
    vehicle_number: requiredText(40),
  }),
]);

export type Registration = z.infer<typeof registrationSchema>;

export function parseRegistrationMetadata(metadata: unknown): Registration {
  const registration =
    typeof metadata === "object" &&
    metadata !== null &&
    "registration" in metadata
      ? metadata.registration
      : undefined;
  const result = registrationSchema.safeParse(registration);
  if (!result.success) {
    throw new HttpError(
      "Registration details are incomplete or invalid. Return to registration and try again.",
      400,
    );
  }
  return result.data;
}

export async function getAuthProfile(userId: string): Promise<AuthProfile | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, is_suspended")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Could not read the authenticated user's profile:", error);
    throw new HttpError("We couldn't load your account profile.", 500);
  }
  if (!data) return null;

  let isApproved = data.role !== "ngo" && data.role !== "delivery_partner_pending";
  if (data.role === "ngo") {
    const { data: ngoProfile, error: ngoError } = await supabase
      .from("ngo_profiles")
      .select("is_verified")
      .eq("user_id", userId)
      .maybeSingle();
    if (ngoError) {
      console.error("Could not read NGO approval status:", ngoError);
      throw new HttpError("We couldn't load your approval status.", 500);
    }
    isApproved = ngoProfile?.is_verified === true;
  }

  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    is_approved: isApproved,
    is_suspended: data.is_suspended === true,
  };
}

export async function completeRegistration(
  userId: string,
  email: string,
  metadata: unknown,
): Promise<AuthProfile> {
  const registration = parseRegistrationMetadata(metadata);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc(
    "complete_foodbridge_registration",
    {
      p_user_id: userId,
      p_email: email,
      p_registration: registration,
    },
  );

  if (error) {
    console.error("Trusted registration completion failed:", error);
    throw new HttpError(
      "We couldn't finish setting up your profile. Please try again or contact support.",
      500,
    );
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.profile_id || typeof result.role !== "string") {
    throw new HttpError(
      "Registration could not confirm your profile. Please contact support.",
      500,
    );
  }

  const donorType =
    registration.role === "donor" ? registration.donor_type : undefined;
  const { error: metadataError } = await supabase.auth.admin.updateUserById(
    userId,
    { user_metadata: donorType ? { donor_type: donorType } : {} },
  );
  if (metadataError) {
    console.error("Could not clear temporary registration metadata:", metadataError);
    throw new HttpError(
      "Your profile was created, but account setup needs one more retry. Please sign in and try again.",
      500,
    );
  }

  const profile = await getAuthProfile(userId);
  if (!profile) {
    throw new HttpError("Your profile could not be loaded after registration.", 500);
  }
  return profile;
}

async function getPendingNgoApprovals(): Promise<PendingApproval[]> {
  const supabase = getSupabaseAdmin();
  const { data: ngoProfiles, error: ngoError } = await supabase
    .from("ngo_profiles")
    .select("user_id, organization_name, registration_number")
    .eq("is_verified", false)
    .not("user_id", "is", null);

  if (ngoError) {
    console.error("Could not list pending NGO approvals:", ngoError);
    throw new HttpError("We couldn't load pending approvals.", 500);
  }
  const ngoIds = [...new Set((ngoProfiles ?? []).map((item) => item.user_id))];
  if (!ngoIds.length) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role")
    .in("id", ngoIds)
    .eq("role", "ngo");
  if (profileError) {
    console.error("Could not load NGO account details:", profileError);
    throw new HttpError("We couldn't load pending approvals.", 500);
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return (ngoProfiles ?? []).flatMap((ngo) => {
    const profile = profileById.get(ngo.user_id);
    if (!profile) return [];
    return [{
      user_id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      role: "ngo" as const,
      organization_name: ngo.organization_name,
      registration_number: ngo.registration_number,
    }];
  });
}

async function getPendingPartnerApprovals(): Promise<PendingApproval[]> {
  const supabase = getSupabaseAdmin();
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role")
    .eq("role", "delivery_partner_pending");
  if (profileError) {
    console.error("Could not list pending delivery partner approvals:", profileError);
    throw new HttpError("We couldn't load pending approvals.", 500);
  }
  const userIds = (profiles ?? []).map((profile) => profile.id);
  if (!userIds.length) return [];

  const { data: partners, error: partnerError } = await supabase
    .from("partner_profiles")
    .select("user_id, vehicle_type, vehicle_number")
    .in("user_id", userIds);
  if (partnerError) {
    console.error("Could not load delivery partner details:", partnerError);
    throw new HttpError("We couldn't load pending approvals.", 500);
  }

  const partnerById = new Map((partners ?? []).map((partner) => [partner.user_id, partner]));
  return (profiles ?? []).flatMap((profile) => {
    const partner = partnerById.get(profile.id);
    if (!partner) return [];
    return [{
      user_id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      role: "delivery_partner_pending" as const,
      vehicle_type: partner.vehicle_type,
      vehicle_number: partner.vehicle_number,
    }];
  });
}

export async function listPendingApprovals(): Promise<PendingApproval[]> {
  const [ngos, partners] = await Promise.all([
    getPendingNgoApprovals(),
    getPendingPartnerApprovals(),
  ]);
  return [...ngos, ...partners];
}

export async function approveRegistration(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    console.error("Could not read approval target:", profileError);
    throw new HttpError("We couldn't load that approval request.", 500);
  }
  if (!profile) {
    throw new HttpError("That approval request was not found.", 404);
  }

  if (profile.role === "ngo") {
    const { data, error } = await supabase
      .from("ngo_profiles")
      .update({ is_verified: true })
      .eq("user_id", userId)
      .eq("is_verified", false)
      .select("user_id")
      .maybeSingle();
    if (error) {
      console.error("Could not approve NGO:", error);
      throw new HttpError("We couldn't approve this NGO.", 500);
    }
    if (!data) {
      throw new HttpError("This NGO is already approved or has no profile.", 409);
    }
    return;
  }

  if (profile.role === "delivery_partner_pending") {
    const { data: partner, error: partnerError } = await supabase
      .from("partner_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (partnerError) {
      console.error("Could not load delivery partner approval:", partnerError);
      throw new HttpError("We couldn't approve this delivery partner.", 500);
    }
    if (!partner) {
      throw new HttpError("This delivery partner has no profile.", 409);
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ role: "delivery_partner" })
      .eq("id", userId)
      .eq("role", "delivery_partner_pending")
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("Could not approve delivery partner:", error);
      throw new HttpError("We couldn't approve this delivery partner.", 500);
    }
    if (!data) {
      throw new HttpError("This delivery partner is already approved.", 409);
    }
    return;
  }

  throw new HttpError("This account is not awaiting approval.", 409);
}
