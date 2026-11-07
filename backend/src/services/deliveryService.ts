import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { AppRole } from "../types/auth.js";
import { HttpError } from "../utils/HttpError.js";
import type { deliveryStatusSchema } from "../validators/domainSchemas.js";
import {
  failDatabase,
  getOwnedProfileId,
  requireVerifiedNgo,
  requireVerifiedPartner,
} from "./domainCommon.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";

type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;
const proofBucket = "delivery-proofs";
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const maximumProofSize = 5 * 1024 * 1024;

export async function listAvailableAssignments(
  userId: string,
  limit: number,
  offset: number,
) {
  const partnerId = await requireVerifiedPartner(userId);
  const { data: partner, error: partnerError } = await getSupabaseAdmin()
    .from("partner_profiles")
    .select("availability")
    .eq("id", partnerId)
    .single();
  if (partnerError) failDatabase(partnerError, "Could not load partner availability:");
  if (!partner.availability) return [];

  const { data, error } = await getSupabaseAdmin()
    .from("donation_assignments")
    .select("*, donations!inner(*)")
    .is("partner_id", null)
    .eq("status", "accepted")
    .eq("donations.status", "matched")
    .gt("donations.expiry_time", new Date().toISOString())
    .order("assigned_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load available assignments:");
  return data ?? [];
}

export async function acceptAssignment(userId: string, assignmentId: string) {
  const partnerId = await requireVerifiedPartner(userId);
  const { data, error } = await getSupabaseAdmin().rpc(
    "foodbridge_accept_assignment",
    { p_assignment_id: assignmentId, p_partner_id: partnerId },
  );
  if (error) {
    if (error.code === "P0002") throw new HttpError("Assignment not found.", 404);
    if (error.code === "23505" || error.code === "55000" || error.code === "42501") {
      throw new HttpError("This assignment is no longer available.", 409);
    }
    failDatabase(error, "Could not accept delivery assignment:");
  }
  return Array.isArray(data) ? data[0] : data;
}

export async function updateDeliveryStatus(
  userId: string,
  assignmentId: string,
  input: DeliveryStatus,
) {
  const partnerId = await requireVerifiedPartner(userId);
  const { data, error } = await getSupabaseAdmin().rpc(
    "foodbridge_update_delivery_status",
    {
      p_assignment_id: assignmentId,
      p_partner_id: partnerId,
      p_status: input.status,
      p_description: input.description ?? null,
    },
  );
  if (error) {
    if (error.code === "P0002") throw new HttpError("Assignment not found.", 404);
    if (error.code === "55000") {
      throw new HttpError(
        "The delivery status transition is not allowed or required proof is missing.",
        409,
      );
    }
    failDatabase(error, "Could not update delivery status:");
  }
  return Array.isArray(data) ? data[0] : data;
}

export async function listPartnerAssignments(
  userId: string,
  limit: number,
  offset: number,
) {
  const partnerId = await requireVerifiedPartner(userId);
  const { data, error } = await getSupabaseAdmin()
    .from("donation_assignments")
    .select("*, donations(*)")
    .eq("partner_id", partnerId)
    .order("assigned_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load partner assignments:");
  return data ?? [];
}

export async function uploadDeliveryProof(
  userId: string,
  assignmentId: string,
  contentType: string,
  content: Buffer,
  notes?: string,
) {
  const partnerId = await requireVerifiedPartner(userId);
  const extension = allowedTypes.get(contentType);
  if (!extension) {
    throw new HttpError("Upload a JPEG, PNG, or WebP delivery image.", 415);
  }
  if (!content.length) throw new HttpError("Delivery proof cannot be empty.", 400);
  if (content.length > maximumProofSize) {
    throw new HttpError("Delivery proof must be no larger than 5 MB.", 413);
  }

  const supabase = getSupabaseAdmin();
  const { data: assignment, error: assignmentError } = await supabase
    .from("donation_assignments")
    .select("id, status")
    .eq("id", assignmentId)
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (assignmentError) {
    failDatabase(assignmentError, "Could not verify delivery assignment:");
  }
  if (!assignment) throw new HttpError("Assignment not found.", 404);
  if (!["assigned", "picked_up"].includes(assignment.status)) {
    throw new HttpError("Proof can only be uploaded for an active delivery.", 409);
  }

  const objectPath = `${userId}/${assignmentId}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(proofBucket)
    .upload(objectPath, new Uint8Array(content), {
      contentType,
      upsert: false,
    });
  if (uploadError) failDatabase(uploadError, "Could not store delivery proof:");

  const { data, error } = await supabase
    .from("delivery_proofs")
    .insert({
      assignment_id: assignmentId,
      proof_url: objectPath,
      notes: notes?.trim() || null,
    })
    .select("id, assignment_id, notes, delivered_at")
    .single();
  if (error) {
    const { error: cleanupError } = await supabase.storage
      .from(proofBucket)
      .remove([objectPath]);
    if (cleanupError) {
      console.error("Could not remove orphaned delivery proof object:", cleanupError);
    }
    failDatabase(error, "Could not save delivery proof details:");
  }
  return { ...data, proof_url: objectPath };
}

export async function getDeliveryProofUrl(
  userId: string,
  proofId: string,
  role: AppRole,
) {
  if (role === "delivery_partner") await requireVerifiedPartner(userId);
  if (role === "ngo") await requireVerifiedNgo(userId);
  const donorId =
    role === "donor" ? await getOwnedProfileId("donor_profiles", userId) : null;
  const supabase = getSupabaseAdmin();
  const { data: proof, error } = await supabase
    .from("delivery_proofs")
    .select("id, assignment_id, proof_url")
    .eq("id", proofId)
    .maybeSingle();
  if (error) failDatabase(error, "Could not load delivery proof:");
  if (!proof) throw new HttpError("Delivery proof not found.", 404);

  const { data: assignment, error: assignmentError } = await supabase
    .from("donation_assignments")
    .select("id, donation_id, ngo_id, partner_id")
    .eq("id", proof.assignment_id)
    .maybeSingle();
  if (assignmentError) {
    failDatabase(assignmentError, "Could not verify delivery proof access:");
  }
  if (!assignment) throw new HttpError("Delivery proof not found.", 404);
  let allowed = role === "admin";
  if (role === "donor" && donorId) {
    const { data: donation, error: donationError } = await supabase
      .from("donations")
      .select("id")
      .eq("id", assignment.donation_id)
      .eq("donor_id", donorId)
      .maybeSingle();
    if (donationError) failDatabase(donationError, "Could not verify proof ownership:");
    allowed = Boolean(donation);
  } else if (role === "ngo") {
    const ngoId = await requireVerifiedNgo(userId);
    allowed = assignment.ngo_id === ngoId;
  } else if (role === "delivery_partner") {
    const partnerId = await requireVerifiedPartner(userId);
    allowed = assignment.partner_id === partnerId;
  }
  if (!allowed) throw new HttpError("Delivery proof not found.", 404);

  const { data, error: signedUrlError } = await supabase.storage
    .from(proofBucket)
    .createSignedUrl(proof.proof_url, 60);
  if (signedUrlError) {
    failDatabase(signedUrlError, "Could not create delivery proof link:");
  }
  return { url: data.signedUrl, expires_in: 60 };
}
