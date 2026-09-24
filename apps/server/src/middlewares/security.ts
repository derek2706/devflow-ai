import type { RequestHandler } from "express";
import { isAllowedOrigin } from "../config/origins";
import { ApiError } from "../shared/errors/ApiError";
import { HTTP_STATUS } from "../shared/constants/http-status";

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  next();
};

// Cookies are SameSite=Lax; the origin check additionally protects browser writes.
export const verifyOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.headers.origin;
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    origin &&
    !isAllowedOrigin(origin)
  ) {
    next(new ApiError(HTTP_STATUS.FORBIDDEN, "Request origin is not allowed"));
    return;
  }
  next();
};

export function rateLimit(max: number, windowMs: number): RequestHandler {
  const clients = new Map<string, { count: number; expires: number }>();
  return (req, res, next) => {
    const key = req.auth?.userId ?? req.ip ?? "unknown";
    const now = Date.now();
    let entry = clients.get(key);
    if (!entry || entry.expires <= now) {
      if (clients.size >= 10_000) {
        for (const [client, value] of clients)
          if (value.expires <= now) clients.delete(client);
        if (clients.size >= 10_000) {
          res.setHeader("Retry-After", Math.ceil(windowMs / 1000));
          next(
            new ApiError(
              HTTP_STATUS.TOO_MANY_REQUESTS,
              "Too many requests. Please try again later.",
            ),
          );
          return;
        }
      }
      entry = { count: 0, expires: now + windowMs };
      clients.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader(
        "Retry-After",
        Math.max(1, Math.ceil((entry.expires - now) / 1000)),
      );
      next(
        new ApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          "Too many requests. Please try again later.",
        ),
      );
      return;
    }
    next();
  };
}
