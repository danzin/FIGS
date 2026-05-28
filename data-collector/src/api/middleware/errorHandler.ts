import {
  isAppError,
  toErrorResponse,
  wrapError,
} from "@financialsignalsgatheringsystem/common";
import { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = isAppError(error)
    ? error
    : wrapError(error, "InternalServerError", {
        context: {
          method: req.method,
          path: req.originalUrl,
          operation: "handleRequest",
          service: "data-collector-api",
        },
      });
  const includeDebugInfo = process.env.NODE_ENV !== "production";
  const payload = toErrorResponse(appError, { includeDebugInfo });

  console.error("[ApiServer] Request error", {
    method: req.method,
    path: req.originalUrl,
    error: payload,
  });

  res.status(appError.statusCode).json({ error: payload });
};
