import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { failDatabase } from "./domainCommon.js";

export async function recordDonationEvent(input: {
  donationId: string;
  status: string;
  description: string;
  responsibleUserId?: string | null;
  location?: string | null;
}) {
  const { error } = await getSupabaseAdmin()
    .from("status_events")
    .insert({
      donation_id: input.donationId,
      status: input.status,
      description: input.description,
      responsible_user_id: input.responsibleUserId ?? null,
      location: input.location ?? null,
    });
  if (error) failDatabase(error, "Could not record donation timeline event:");
}
