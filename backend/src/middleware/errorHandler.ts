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

  if (typeof error === "object" && error !== null && "type" in error) {
    const type = error.type;
    if (type === "entity.too.large") {
      response.status(413).json({ error: "Request body is too large." });
      return;
    }
    if (type === "entity.parse.failed") {
      response.status(400).json({ error: "Request body is not valid JSON." });
      return;
    }
    if (type === "encoding.unsupported" || type === "charset.unsupported") {
      response.status(415).json({ error: "Request encoding is not supported." });
      return;
    }
  }

  console.error("Unhandled API error:", error);
  const body: ApiErrorResponse = { error: "An unexpected server error occurred." };
  response.status(500).json(body);
};
