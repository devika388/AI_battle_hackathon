import type { RequestHandler } from "express";
import { getAuthProfile } from "../services/authService.js";
import type { AppRole } from "../types/auth.js";
import { HttpError } from "../utils/HttpError.js";

export function requireRole(...roles: AppRole[]): RequestHandler {
  return async (request, _response, next) => {
    try {
      const user = request.authUser;
      if (!user) throw new HttpError("Sign in to continue.", 401);

      const profile = await getAuthProfile(user.id);
      if (!profile) throw new HttpError("Your account profile was not found.", 403);
      if (profile.is_suspended) {
        throw new HttpError("This account is suspended.", 403);
      }
      if (!roles.includes(profile.role as AppRole)) {
        throw new HttpError("You do not have permission to perform this action.", 403);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
