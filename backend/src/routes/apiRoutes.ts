import { Router } from "express";
import express from "express";
import {
  approveRegistrationController,
  authProfileController,
  completeRegistrationController,
  pendingApprovalsController,
} from "../controllers/authController.js";
import {
  acceptAssignmentController,
  acceptDonationController,
  acceptedDonationsController,
  availableAssignmentsController,
  cancelDonationController,
  createDonationController,
  confirmNgoReceiptController,
  currentUserController,
  declineDonationController,
  deliveryProofUrlController,
  donorHistoryController,
  getDonationController,
  impactController,
  listEligibleDonationsController,
  listNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
  matchingDonationsController,
  partnerAssignmentsController,
  updateCurrentProfileController,
  updateDeliveryStatusController,
  updateDeliveryStageController,
  updateDonationController,
  uploadDeliveryProofController,
} from "../controllers/domainController.js";
import {
  adminImpactController,
  adminDashboardReportController,
  listRescueRequestsController,
  listUsersController,
  monitorAssignmentsController,
  monitorDonationsController,
  scanCommunityRescueController,
  setSuspensionController,
  rejectVerificationController,
  updateRescueRequestController,
  verifyNgoController,
  verifyPartnerController,
} from "../controllers/adminController.js";
import { healthController } from "../controllers/healthController.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  assignmentIdParams,
  assignmentAcceptSchema,
  donationCreateSchema,
  donationIdParams,
  donationUpdateSchema,
  deliveryStatusSchema,
  deliveryStageSchema,
  notificationIdParams,
  paginationQuery,
  profileUpdateSchema,
  proofIdParams,
  rescueIdParams,
  rescueUpdateSchema,
  suspensionSchema,
  userIdParams,
  verificationRejectionSchema,
  verificationRejectionParams,
} from "../validators/domainSchemas.js";

export const apiRoutes = Router();

apiRoutes.get("/health", healthController);
const authenticated = [requireAuth] as const;
const page = validateQuery(paginationQuery);

apiRoutes.get(
  "/auth/me",
  ...authenticated,
  authProfileController,
);
apiRoutes.post(
  "/auth/complete-registration",
  ...authenticated,
  completeRegistrationController,
);
apiRoutes.get(
  "/admin/approvals",
  ...authenticated,
  requireAdmin,
  pendingApprovalsController,
);
apiRoutes.post(
  "/admin/approvals/:userId/approve",
  ...authenticated,
  requireAdmin,
  validateParams(userIdParams),
  approveRegistrationController,
);

apiRoutes.get(
  "/profile",
  ...authenticated,
  requireRole("donor", "ngo", "delivery_partner_pending", "delivery_partner", "admin"),
  asyncHandler(currentUserController),
);
apiRoutes.patch(
  "/profile",
  ...authenticated,
  requireRole("donor", "ngo", "delivery_partner_pending", "delivery_partner", "admin"),
  validateBody(profileUpdateSchema),
  asyncHandler(updateCurrentProfileController),
);

apiRoutes.post(
  "/donations",
  ...authenticated,
  requireRole("donor"),
  validateBody(donationCreateSchema),
  asyncHandler(createDonationController),
);
apiRoutes.get(
  "/donations/eligible",
  ...authenticated,
  requireRole("ngo"),
  page,
  asyncHandler(listEligibleDonationsController),
);
apiRoutes.get(
  "/donations/mine",
  ...authenticated,
  requireRole("donor"),
  page,
  asyncHandler(donorHistoryController),
);
apiRoutes.get(
  "/donations/:donationId",
  ...authenticated,
  requireRole("donor", "ngo", "delivery_partner", "admin"),
  validateParams(donationIdParams),
  asyncHandler(getDonationController),
);
apiRoutes.patch(
  "/donations/:donationId",
  ...authenticated,
  requireRole("donor"),
  validateParams(donationIdParams),
  validateBody(donationUpdateSchema),
  asyncHandler(updateDonationController),
);
apiRoutes.delete(
  "/donations/:donationId",
  ...authenticated,
  requireRole("donor"),
  validateParams(donationIdParams),
  asyncHandler(cancelDonationController),
);

apiRoutes.get(
  "/ngo/donations/matching",
  ...authenticated,
  requireRole("ngo"),
  page,
  asyncHandler(matchingDonationsController),
);
apiRoutes.get(
  "/ngo/donations/accepted",
  ...authenticated,
  requireRole("ngo"),
  page,
  asyncHandler(acceptedDonationsController),
);
apiRoutes.post(
  "/ngo/donations/:donationId/accept",
  ...authenticated,
  requireRole("ngo"),
  validateParams(donationIdParams),
  asyncHandler(acceptDonationController),
);
apiRoutes.post(
  "/ngo/donations/:donationId/decline",
  ...authenticated,
  requireRole("ngo"),
  validateParams(donationIdParams),
  asyncHandler(declineDonationController),
);
apiRoutes.post(
  "/ngo/assignments/:assignmentId/confirm-receipt",
  ...authenticated,
  requireRole("ngo"),
  validateParams(assignmentIdParams),
  asyncHandler(confirmNgoReceiptController),
);

apiRoutes.get(
  "/partners/assignments/available",
  ...authenticated,
  requireRole("delivery_partner"),
  page,
  asyncHandler(availableAssignmentsController),
);
apiRoutes.get(
  "/partners/assignments",
  ...authenticated,
  requireRole("delivery_partner"),
  page,
  asyncHandler(partnerAssignmentsController),
);
apiRoutes.post(
  "/partners/assignments/:assignmentId/accept",
  ...authenticated,
  requireRole("delivery_partner"),
  validateParams(assignmentIdParams),
  validateBody(assignmentAcceptSchema),
  asyncHandler(acceptAssignmentController),
);
apiRoutes.patch(
  "/partners/assignments/:assignmentId/status",
  ...authenticated,
  requireRole("delivery_partner"),
  validateParams(assignmentIdParams),
  validateBody(deliveryStatusSchema),
  asyncHandler(updateDeliveryStatusController),
);
apiRoutes.patch(
  "/partners/assignments/:assignmentId/stage",
  ...authenticated,
  requireRole("delivery_partner"),
  validateParams(assignmentIdParams),
  validateBody(deliveryStageSchema),
  asyncHandler(updateDeliveryStageController),
);
apiRoutes.post(
  "/partners/assignments/:assignmentId/proof",
  ...authenticated,
  requireRole("delivery_partner"),
  validateParams(assignmentIdParams),
  express.raw({
    type: ["image/jpeg", "image/png", "image/webp"],
    limit: "5mb",
  }),
  asyncHandler(uploadDeliveryProofController),
);
apiRoutes.get(
  "/partners/proofs/:proofId/url",
  ...authenticated,
  requireRole("donor", "ngo", "delivery_partner", "admin"),
  validateParams(proofIdParams),
  asyncHandler(deliveryProofUrlController),
);

apiRoutes.get(
  "/notifications",
  ...authenticated,
  requireRole("donor", "ngo", "delivery_partner_pending", "delivery_partner", "admin"),
  page,
  asyncHandler(listNotificationsController),
);
apiRoutes.patch(
  "/notifications/:notificationId/read",
  ...authenticated,
  requireRole("donor", "ngo", "delivery_partner_pending", "delivery_partner", "admin"),
  validateParams(notificationIdParams),
  asyncHandler(markNotificationReadController),
);
apiRoutes.post(
  "/notifications/read-all",
  ...authenticated,
  requireRole("donor", "ngo", "delivery_partner_pending", "delivery_partner", "admin"),
  asyncHandler(markAllNotificationsReadController),
);

apiRoutes.get(
  "/impact",
  ...authenticated,
  requireRole("donor", "ngo", "delivery_partner", "admin"),
  asyncHandler(impactController),
);

apiRoutes.get(
  "/admin/users",
  ...authenticated,
  requireAdmin,
  page,
  asyncHandler(listUsersController),
);
apiRoutes.patch(
  "/admin/users/:userId/suspension",
  ...authenticated,
  requireAdmin,
  validateParams(userIdParams),
  validateBody(suspensionSchema),
  asyncHandler(setSuspensionController),
);
apiRoutes.post(
  "/admin/ngos/:userId/verify",
  ...authenticated,
  requireAdmin,
  validateParams(userIdParams),
  asyncHandler(verifyNgoController),
);
apiRoutes.post(
  "/admin/partners/:userId/verify",
  ...authenticated,
  requireAdmin,
  validateParams(userIdParams),
  asyncHandler(verifyPartnerController),
);
apiRoutes.post(
  "/admin/:kind/:userId/reject",
  ...authenticated,
  requireAdmin,
  validateParams(verificationRejectionParams),
  validateBody(verificationRejectionSchema),
  asyncHandler(rejectVerificationController),
);
apiRoutes.get(
  "/admin/donations",
  ...authenticated,
  requireAdmin,
  page,
  asyncHandler(monitorDonationsController),
);
apiRoutes.get(
  "/admin/assignments",
  ...authenticated,
  requireAdmin,
  page,
  asyncHandler(monitorAssignmentsController),
);
apiRoutes.get(
  "/admin/rescue-requests",
  ...authenticated,
  requireAdmin,
  page,
  asyncHandler(listRescueRequestsController),
);
apiRoutes.post(
  "/admin/rescue-requests/scan",
  ...authenticated,
  requireAdmin,
  asyncHandler(scanCommunityRescueController),
);
apiRoutes.patch(
  "/admin/rescue-requests/:rescueId",
  ...authenticated,
  requireAdmin,
  validateParams(rescueIdParams),
  validateBody(rescueUpdateSchema),
  asyncHandler(updateRescueRequestController),
);
apiRoutes.get(
  "/admin/impact",
  ...authenticated,
  requireAdmin,
  asyncHandler(adminImpactController),
);
apiRoutes.get(
  "/admin/reports",
  ...authenticated,
  requireAdmin,
  asyncHandler(adminDashboardReportController),
);
