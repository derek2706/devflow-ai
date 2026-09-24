import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import jwt from "jsonwebtoken";
import { durationMs, getEnv } from "../../config/env";
import { ApiError } from "../../shared/errors/ApiError";
import { HTTP_STATUS } from "../../shared/constants/http-status";
import { AUTH_MESSAGES } from "./auth.constants";

export const randomToken = () => randomBytes(32).toString("base64url");
export const resetHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const refreshHash = (token: string) =>
  createHmac("sha256", getEnv().JWT_REFRESH_SECRET).update(token).digest("hex");
export function hashesEqual(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export function accessToken(userId: string, sessionId: string) {
  const env = getEnv();
  return jwt.sign({ sid: sessionId, kind: "access" }, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    subject: userId,
    issuer: "devflow-ai",
    audience: "devflow-web",
    expiresIn: Math.floor(durationMs(env.ACCESS_TOKEN_EXPIRY) / 1000),
  });
}
export function verifyAccessToken(token?: string): {
  userId: string;
  sessionId: string;
} {
  try {
    if (!token) throw new Error("Missing token");
    const payload = jwt.verify(token, getEnv().JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: "devflow-ai",
      audience: "devflow-web",
    });
    if (
      typeof payload === "string" ||
      payload.kind !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string"
    )
      throw new Error("Invalid token");
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    throw new ApiError(
      HTTP_STATUS.UNAUTHORIZED,
      AUTH_MESSAGES.AUTHENTICATION_REQUIRED,
    );
  }
}
export function parseRefreshToken(token?: string) {
  const match = token && /^([a-f0-9-]{36})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match)
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, AUTH_MESSAGES.SESSION_EXPIRED);
  return { sessionId: match[1]!, token: token! };
}
