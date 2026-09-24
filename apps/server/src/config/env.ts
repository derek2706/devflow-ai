import { config } from "dotenv";
import { z } from "zod";

config({ quiet: true });

const factors: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};
function parsedDuration(value: string) {
  const match = /^([1-9]\d*)([smhd])$/.exec(value);
  return match ? Number(match[1]) * factors[match[2]]! : NaN;
}
const duration = (maximum: number) =>
  z.string().refine((value) => {
    const milliseconds = parsedDuration(value);
    return (
      Number.isSafeInteger(milliseconds) &&
      milliseconds > 0 &&
      milliseconds <= maximum
    );
  }, "Use a positive duration within the configured maximum, such as 15m or 7d");
const browserOrigin = z
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.hostname.includes("*") &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  }, "Use an HTTP(S) origin without credentials, a path, query, or fragment")
  .transform((value) => new URL(value).origin);
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  DATABASE_URL: z.url(),
  WEB_URL: z.url().default("http://localhost:3000"),
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(browserOrigin)),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRY: duration(86_400_000).default("15m"),
  REFRESH_TOKEN_EXPIRY: duration(90 * 86_400_000).default("7d"),
  API_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("DevFlow AI <noreply@example.com>"),
  MAIL_PREVIEW_DIR: z.string().optional(),
  AI_MODE: z.enum(["local", "provider"]).default("local"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
});

// Validate at startup or request time, never terminate merely on app import.
export function getEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(`Invalid environment configuration: ${fields.join(", ")}`);
  }
  if (
    result.data.AI_MODE === "provider" &&
    (!result.data.OPENAI_API_KEY || !result.data.OPENAI_MODEL)
  ) {
    throw new Error(
      "Invalid environment configuration: provider mode requires OPENAI_API_KEY and OPENAI_MODEL",
    );
  }
  return result.data;
}

export const validateEnvironment = getEnv;

export function durationMs(value: string) {
  const milliseconds = parsedDuration(value);
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0)
    throw new Error("Invalid token lifetime");
  return milliseconds;
}
