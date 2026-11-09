import type { RequestHandler } from "express";
import { getSupabaseAdmin } from "../services/supabaseAdmin.js";
import { HttpError } from "../utils/HttpError.js";

export const requireAuth: RequestHandler = async (request, _response, next) => {
  try {
    const authorization = request.header("authorization");
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) {
      console.warn("Authenticated API request is missing a bearer token.", {
        method: request.method,
        path: request.originalUrl.split("?")[0],
        origin: request.header("origin") ?? null,
      });
      throw new HttpError("Sign in to continue.", 401);
    }

    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data.user) {
      console.warn("Supabase access-token verification failed.", {
        method: request.method,
        path: request.originalUrl.split("?")[0],
        origin: request.header("origin") ?? null,
        status: error?.status ?? null,
        code: error?.code ?? null,
      });
      throw new HttpError(
        "Your session is invalid or expired. Please sign in again.",
        401,
      );
    }

    request.authUser = data.user;
    if (request.originalUrl.split("?")[0] === "/api/auth/me") {
      console.info("Supabase access token verified for profile request.", {
        userId: data.user.id,
      });
    }
    next();
  } catch (error) {
    if (!(error instanceof HttpError) || error.statusCode >= 500) {
      console.error("Authenticated API request could not be verified.", {
        method: request.method,
        path: request.originalUrl.split("?")[0],
        origin: request.header("origin") ?? null,
        errorName: error instanceof Error ? error.name : "UnknownError",
        status: error instanceof HttpError ? error.statusCode : null,
      });
    }
    next(error);
  }
};
