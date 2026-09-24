import { isIP } from "node:net";
import type { Request, RequestHandler } from "express";
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

export function rateLimitClientIp(req: Request) {
  // Startup validates this opt-in. Avoid parsing the entire environment per request.
  // Use Vercel's client-IP header only on its runtime; never trust caller XFF.
  const trustVercelIngress =
    process.env.TRUST_VERCEL_PROXY === "true" &&
    process.env.VERCEL === "1" &&
    process.env.NODE_ENV === "production";
  const forwarded = req.headers["x-vercel-forwarded-for"];
  if (trustVercelIngress && typeof forwarded === "string" && isIP(forwarded)) {
    return forwarded;
  }
  return req.ip ?? "unknown";
}

export function rateLimit(max: number, windowMs: number): RequestHandler {
  const clients = new Map<string, { count: number; expires: number }>();
  return (req, res, next) => {
    const key = req.auth?.userId
      ? `user:${req.auth.userId}`
      : `ip:${rateLimitClientIp(req)}`;
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
