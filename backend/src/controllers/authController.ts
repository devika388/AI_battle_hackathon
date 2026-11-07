import type { RequestHandler } from "express";
import {
  approveRegistration,
  completeRegistration,
  getAuthProfile,
  listPendingApprovals,
} from "../services/authService.js";
import { HttpError } from "../utils/HttpError.js";

export const authProfileController: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const user = request.authUser;
    if (!user) throw new HttpError("Sign in to continue.", 401);

    response.json({
      user: { id: user.id, email: user.email ?? null },
      profile: await getAuthProfile(user.id),
    });
  } catch (error) {
    next(error);
  }
};

export const completeRegistrationController: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const user = request.authUser;
    if (!user) throw new HttpError("Sign in to continue.", 401);
    if (!user.email) {
      throw new HttpError("Your account does not have an email address.", 400);
    }

    const profile = await completeRegistration(
      user.id,
      user.email,
      user.user_metadata,
    );
    response.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
};

export const pendingApprovalsController: RequestHandler = async (
  _request,
  response,
  next,
) => {
  try {
    response.json({ approvals: await listPendingApprovals() });
  } catch (error) {
    next(error);
  }
};

export const approveRegistrationController: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const userId = request.params.userId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      throw new HttpError("The approval request ID is invalid.", 400);
    }
    await approveRegistration(userId);
    response.json({ approved: true });
  } catch (error) {
    next(error);
  }
};
