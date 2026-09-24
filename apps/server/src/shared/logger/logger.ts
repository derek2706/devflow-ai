import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "accessToken",
      "refreshToken",
      "authorization",
      "cookie",
    ],
    censor: "[Redacted]",
  },
});
