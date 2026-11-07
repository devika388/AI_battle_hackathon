import type { RequestHandler } from "express";
import { HttpError } from "../utils/HttpError.js";

export const requireVerifiedEmail: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (!request.authUser?.email_confirmed_at) {
    next(
      new HttpError(
        "Verify your email address before continuing. Your verification link may have expired.",
        403,
      ),
    );
    return;
  }
  next();
};
