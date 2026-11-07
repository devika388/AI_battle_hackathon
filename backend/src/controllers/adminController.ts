import type { Request, Response } from "express";
import {
  listRescueRequests,
  listUsers,
  monitorAssignments,
  monitorDonations,
  setAccountSuspension,
  updateRescueRequest,
} from "../services/adminService.js";
import { getImpactStatistics } from "../services/impactService.js";
import { verifyNgo, verifyDeliveryPartner } from "../services/adminService.js";
import { getAuthProfile } from "../services/authService.js";
import type { AppRole } from "../types/auth.js";
import { HttpError } from "../utils/HttpError.js";
import { paginationQuery } from "../validators/domainSchemas.js";

function requireUser(request: Request) {
  if (!request.authUser) throw new HttpError("Sign in to continue.", 401);
  return request.authUser;
}

function page(request: Request) {
  return paginationQuery.parse(request.query);
}

export async function listUsersController(request: Request, response: Response) {
  const { limit, offset } = page(request);
  response.json({ users: await listUsers(limit, offset) });
}

export async function setSuspensionController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  response.json({
    user: await setAccountSuspension(
      user.id,
      request.params.userId,
      request.body.is_suspended,
    ),
  });
}

export async function verifyNgoController(
  request: Request,
  response: Response,
) {
  response.json({ verification: await verifyNgo(request.params.userId) });
}

export async function verifyPartnerController(
  request: Request,
  response: Response,
) {
  response.json({
    verification: await verifyDeliveryPartner(request.params.userId),
  });
}

export async function monitorDonationsController(
  request: Request,
  response: Response,
) {
  const { limit, offset } = page(request);
  response.json({ donations: await monitorDonations(limit, offset) });
}

export async function monitorAssignmentsController(
  request: Request,
  response: Response,
) {
  const { limit, offset } = page(request);
  response.json({ assignments: await monitorAssignments(limit, offset) });
}

export async function listRescueRequestsController(
  request: Request,
  response: Response,
) {
  const { limit, offset } = page(request);
  response.json({ rescue_requests: await listRescueRequests(limit, offset) });
}

export async function updateRescueRequestController(
  request: Request,
  response: Response,
) {
  response.json({
    rescue_request: await updateRescueRequest(
      request.params.rescueId,
      request.body,
    ),
  });
}

export async function adminImpactController(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  const profile = await getAuthProfile(user.id);
  if (!profile) throw new HttpError("User profile not found.", 404);
  response.json({
    impact: await getImpactStatistics(
      user.id,
      profile.role as AppRole,
      true,
    ),
  });
}
