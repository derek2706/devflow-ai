import { NextFunction, Request, Response } from "express";
import { ApiError } from "./ApiError";
import { HTTP_STATUS } from "../constants/http-status";
import { logger } from "../logger/logger";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) return next(err);
  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json({ success: false, message: err.message });
  }
  const bodyError = err as Error & { type?: string; code?: string };
  if (bodyError.type === "entity.parse.failed") {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ success: false, message: "Invalid JSON request body" });
  }
  if (bodyError.type === "entity.too.large") {
    return res
      .status(HTTP_STATUS.PAYLOAD_TOO_LARGE)
      .json({ success: false, message: "Request body is too large" });
  }
  if (bodyError.code === "P2002") {
    return res
      .status(HTTP_STATUS.CONFLICT)
      .json({ success: false, message: "This record already exists" });
  }
  if (bodyError.code === "P2025") {
    return res
      .status(HTTP_STATUS.NOT_FOUND)
      .json({ success: false, message: "Record not found" });
  }
  logger.error(
    { errorName: err.name, method: req.method, path: req.path },
    "Request failed unexpectedly",
  );
  return res
    .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    .json({ success: false, message: "Internal Server Error" });
}
