import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().int().positive(),

  DATABASE_URL: z.url(),

  JWT_ACCESS_SECRET: z.string().min(32, {
    message: "JWT_ACCESS_SECRET must be at least 32 characters long",
  }),

  JWT_REFRESH_SECRET: z.string().min(32, {
    message: "JWT_REFRESH_SECRET must be at least 32 characters long",
  }),

  ACCESS_TOKEN_EXPIRY: z.string(),

  REFRESH_TOKEN_EXPIRY: z.string(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables");
  console.error(parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
