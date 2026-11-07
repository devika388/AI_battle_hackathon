import type { RequestHandler } from "express";
import { HttpError } from "../utils/HttpError.js";

export const notFound: RequestHandler = (request, _response, next) => {
  next(new HttpError(`Route ${request.method} ${request.path} was not found.`, 404));
};
