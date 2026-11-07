import type { RequestHandler } from "express";
import { getAuthProfile } from "../services/authService.js";
import { HttpError } from "../utils/HttpError.js";

export const requireAdmin: RequestHandler = async (
  request,
  _response,
  next,
) => {
  try {
    const user = request.authUser;
    if (!user) {
      throw new HttpError("Sign in to continue.", 401);
    }

    const profile = await getAuthProfile(user.id);
    if (profile?.role !== "admin") {
      throw new HttpError("Administrator access is required.", 403);
    }
    next();
  } catch (error) {
    next(error);
  }
};
