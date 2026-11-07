import { Router } from "express";
import {
  approveRegistrationController,
  authProfileController,
  completeRegistrationController,
  pendingApprovalsController,
} from "../controllers/authController.js";
import { healthController } from "../controllers/healthController.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail.js";

export const apiRoutes = Router();

apiRoutes.get("/health", healthController);
apiRoutes.get("/auth/me", requireAuth, requireVerifiedEmail, authProfileController);
apiRoutes.post(
  "/auth/complete-registration",
  requireAuth,
  requireVerifiedEmail,
  completeRegistrationController,
);
apiRoutes.get(
  "/admin/approvals",
  requireAuth,
  requireVerifiedEmail,
  requireAdmin,
  pendingApprovalsController,
);
apiRoutes.post(
  "/admin/approvals/:userId/approve",
  requireAuth,
  requireVerifiedEmail,
  requireAdmin,
  approveRegistrationController,
);
