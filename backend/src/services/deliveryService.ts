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
type DeliveryStage = z.infer<typeof import("../validators/domainSchemas.js").deliveryStageSchema>;
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
  await requireVerifiedPartner(userId);

  const { data, error } = await getSupabaseAdmin()
    .from("donation_assignments")
    .select("*, donations!inner(*), ngo_profiles(organization_name, address, city, latitude, longitude)")
    .is("partner_id", null)
    .eq("status", "accepted")
    .eq("donations.status", "matched")
    .gt("donations.expiry_time", new Date().toISOString())
    .lte("donations.preparation_time", new Date().toISOString())
    .order("assigned_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load available assignments:");
  return data ?? [];
}

export async function acceptAssignment(
  userId: string,
  assignmentId: string,
  estimatedDurationMinutes: number,
) {
  const partnerId = await requireVerifiedPartner(userId);
  const { data, error } = await getSupabaseAdmin().rpc(
    "foodbridge_accept_assignment",
    {
      p_assignment_id: assignmentId,
      p_partner_id: partnerId,
      p_estimated_duration_minutes: estimatedDurationMinutes,
    },
  );
  if (error) {
    if (error.code === "P0002") throw new HttpError("Assignment not found.", 404);
    if (error.code === "42501") {
      throw new HttpError(
        "Turn on delivery availability in your profile before accepting an assignment.",
        403,
      );
    }
    if (error.code === "23505") {
      throw new HttpError("Another delivery partner has already accepted this assignment.", 409);
    }
    if (error.code === "55000") {
      throw new HttpError(
        "This assignment is no longer available, the donation has expired or is not ready, or the travel estimate plus 30-minute handoff buffer does not fit before expiry.",
        409,
      );
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
  if (input.status !== "delivered") {
    throw new HttpError(
      "Use the delivery checkpoint workflow to start and confirm pickup.",
      409,
    );
  }
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
  const assignment = Array.isArray(data) ? data[0] : data;
  return assignment;
}

export async function updateDeliveryStage(
  userId: string,
  assignmentId: string,
  input: DeliveryStage,
) {
  const partnerId = await requireVerifiedPartner(userId);
  const { data, error } = await getSupabaseAdmin().rpc(
    "foodbridge_update_delivery_stage",
    {
      p_assignment_id: assignmentId,
      p_partner_id: partnerId,
      p_stage: input.stage,
    },
  );
  if (error) {
    if (error.code === "P0002") throw new HttpError("Assignment not found.", 404);
    if (error.code === "55000") {
      throw new HttpError("Complete the previous delivery checkpoint first.", 409);
    }
    failDatabase(error, "Could not update delivery checkpoint:");
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
    .select("*, donations(*), ngo_profiles(organization_name, address, city, latitude, longitude), delivery_proofs(id, notes, receiver_name, delivered_at)")
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
  receiverName?: string,
  deliveredAt?: string,
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
  const receiver = receiverName?.trim();
  if (!receiver || receiver.length > 120) {
    throw new HttpError("Enter the receiver's name (up to 120 characters).", 400);
  }
  const deliveryDate = deliveredAt ? new Date(deliveredAt) : new Date();
  if (!Number.isFinite(deliveryDate.getTime()) || deliveryDate.getTime() > Date.now() + 5 * 60_000) {
    throw new HttpError("Enter a valid delivery timestamp no more than five minutes in the future.", 400);
  }

  const supabase = getSupabaseAdmin();
  const { data: assignment, error: assignmentError } = await supabase
    .from("donation_assignments")
    .select("id, donation_id, status, delivery_stage")
    .eq("id", assignmentId)
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (assignmentError) {
    failDatabase(assignmentError, "Could not verify delivery assignment:");
  }
  if (!assignment) throw new HttpError("Assignment not found.", 404);
  if (assignment.delivery_stage !== "arrived") {
    throw new HttpError("Confirm arrival at the NGO before uploading delivery proof.", 409);
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
      receiver_name: receiver,
      delivered_at: deliveryDate.toISOString(),
    })
    .select("id, assignment_id, notes, receiver_name, delivered_at")
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
  const { error: stageError } = await supabase
    .from("donation_assignments")
    .update({ delivery_stage: "proof_submitted" })
    .eq("id", assignmentId)
    .eq("partner_id", partnerId)
    .eq("delivery_stage", "arrived");
  if (stageError) failDatabase(stageError, "Could not update delivery proof checkpoint:");
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
