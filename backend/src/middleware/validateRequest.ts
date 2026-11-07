import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { HttpError } from "../utils/HttpError.js";

function formatIssues(issues: { path: PropertyKey[]; message: string }[]) {
  return issues
    .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
    .join("; ");
}

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      next(new HttpError(formatIssues(result.error.issues), 400));
      return;
    }
    request.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      next(new HttpError(formatIssues(result.error.issues), 400));
      return;
    }
    next();
  };
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      next(new HttpError(formatIssues(result.error.issues), 400));
      return;
    }
    next();
  };
}
