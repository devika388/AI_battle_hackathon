import type { RequestHandler } from "express";
import { getSupabaseAdmin } from "../services/supabaseAdmin.js";
import { HttpError } from "../utils/HttpError.js";

export const requireAuth: RequestHandler = async (request, _response, next) => {
  try {
    const authorization = request.header("authorization");
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) {
      throw new HttpError("Sign in to continue.", 401);
    }

    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data.user) {
      throw new HttpError(
        "Your session is invalid or expired. Please sign in again.",
        401,
      );
    }

    request.authUser = data.user;
    next();
  } catch (error) {
    next(error);
  }
};
