import type { Request, Response } from "express";
import { getAuthProfile } from "../services/authService.js";
import {
  acceptDonation,
  cancelDonation,
  confirmNgoReceipt,
  createDonation,
  declineDonation,
  getDonation,
  listAcceptedDonations,
  listDonorDonations,
  listEligibleDonations,
  listMatchingDonations,
  updateDonation,
} from "../services/donationService.js";
import {
  acceptAssignment,
  getDeliveryProofUrl,
  listAvailableAssignments,
  listPartnerAssignments,
  updateDeliveryStatus,
  updateDeliveryStage,
  uploadDeliveryProof,
} from "../services/deliveryService.js";
import {
  getImpactDashboard,
  getImpactStatistics,
} from "../services/impactService.js";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService.js";
import {
  getUserProfile,
  updateUserProfile,
} from "../services/profileService.js";
import {
  paginationQuery,
} from "../validators/domainSchemas.js";
import { HttpError } from "../utils/HttpError.js";
import type { AppRole } from "../types/auth.js";

function requireUser(request: Request) {
  if (!request.authUser) throw new HttpError("Sign in to continue.", 401);
  return request.authUser;
}

function page(request: Request) {
  return paginationQuery.parse(request.query);
}

export async function currentUserController(request: Request, response: Response) {
  const user = requireUser(request);
  const profile = await getUserProfile(user.id);
  if (!profile) throw new HttpError("User profile not found.", 404);
  response.json({ user: { id: user.id, email: user.email ?? null }, profile });
}

export async function updateCurrentProfileController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.json({ profile: await updateUserProfile(user.id, request.body) });
}

export async function createDonationController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.status(201).json({ donation: await createDonation(user.id, request.body) });
}

export async function listEligibleDonationsController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  const { limit, offset } = page(request);
  response.json({
    donations: await listEligibleDonations(user.id, limit, offset),
  });
}

export async function getDonationController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  const profile = await getAuthProfile(user.id);
  if (!profile) throw new HttpError("User profile not found.", 404);
  response.json({
    donation: await getDonation(
      request.params.donationId,
      user.id,
      profile.role as AppRole,
    ),
  });
}

export async function updateDonationController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.json({
    donation: await updateDonation(
      user.id,
      request.params.donationId,
      request.body,
    ),
  });
}

export async function cancelDonationController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.json({
    donation: await cancelDonation(user.id, request.params.donationId),
  });
}

export async function donorHistoryController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  const { limit, offset } = page(request);
  response.json({
    donations: await listDonorDonations(user.id, limit, offset),
  });
}

export async function matchingDonationsController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  const { limit, offset } = page(request);
  response.json({
    matches: await listMatchingDonations(user.id, limit, offset),
  });
}

export async function acceptDonationController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.status(201).json({
    assignment: await acceptDonation(user.id, request.params.donationId),
  });
}

export async function declineDonationController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.json({
    match: await declineDonation(user.id, request.params.donationId),
  });
}

export async function acceptedDonationsController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  const { limit, offset } = page(request);
  response.json({
    assignments: await listAcceptedDonations(user.id, limit, offset),
  });
}

export async function confirmNgoReceiptController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.json({
    assignment: await confirmNgoReceipt(user.id, request.params.assignmentId),
  });
}

export async function availableAssignmentsController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  const { limit, offset } = page(request);
  response.json({
    assignments: await listAvailableAssignments(user.id, limit, offset),
  });
}

export async function partnerAssignmentsController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  const { limit, offset } = page(request);
  response.json({
    assignments: await listPartnerAssignments(user.id, limit, offset),
  });
}

export async function acceptAssignmentController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.status(201).json({
    assignment: await acceptAssignment(
      user.id,
      request.params.assignmentId,
      request.body.estimated_duration_minutes,
    ),
  });
}

export async function updateDeliveryStatusController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.json({
    assignment: await updateDeliveryStatus(
      user.id,
      request.params.assignmentId,
      request.body,
    ),
  });
}

export async function updateDeliveryStageController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.json({
    assignment: await updateDeliveryStage(
      user.id,
      request.params.assignmentId,
      request.body,
    ),
  });
}

export async function uploadDeliveryProofController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  if (!Buffer.isBuffer(request.body)) {
    throw new HttpError("Send the image as a raw JPEG, PNG, or WebP request body.", 415);
  }
  let receiverName: string;
  let notes: string;
  try {
    receiverName = decodeURIComponent(request.header("x-receiver-name") ?? "");
    notes = decodeURIComponent(request.header("x-proof-notes") ?? "");
  } catch {
    throw new HttpError("Delivery proof metadata is malformed.", 400);
  }
  response.status(201).json({
    proof: await uploadDeliveryProof(
      user.id,
      request.params.assignmentId,
      request.header("content-type")?.split(";")[0].trim() ?? "",
      request.body,
      notes.slice(0, 500),
      receiverName.slice(0, 120),
      request.header("x-delivered-at"),
    ),
  });
}

export async function deliveryProofUrlController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  const profile = await getAuthProfile(user.id);
  if (!profile) throw new HttpError("User profile not found.", 404);
  response.json({
    proof: await getDeliveryProofUrl(
      user.id,
      request.params.proofId,
      profile.role,
    ),
  });
}

export async function listNotificationsController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  const { limit, offset } = page(request);
  response.json({
    notifications: await listNotifications(user.id, limit, offset),
    unread_count: await getUnreadNotificationCount(user.id),
  });
}

export async function markNotificationReadController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.json({
    notification: await markNotificationRead(user.id, request.params.notificationId),
  });
}

export async function markAllNotificationsReadController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.json(await markAllNotificationsRead(user.id));
}

export async function impactController(request: Request, response: Response) {
  const user = requireUser(request);
  const profile = await getAuthProfile(user.id);
  if (!profile) throw new HttpError("User profile not found.", 404);
  response.json({
    impact: await getImpactStatistics(user.id, profile.role as AppRole),
    report: await getImpactDashboard(user.id, profile.role as AppRole),
  });
}
