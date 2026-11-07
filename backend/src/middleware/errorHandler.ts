import type { ErrorRequestHandler } from "express";
import { HttpError } from "../utils/HttpError.js";
import type { ApiErrorResponse } from "../types/api.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof HttpError) {
    const body: ApiErrorResponse = { error: error.message };
    response.status(error.statusCode).json(body);
    return;
  }

  console.error("Unhandled API error:", error);
  const body: ApiErrorResponse = { error: "An unexpected server error occurred." };
  response.status(500).json(body);
};
