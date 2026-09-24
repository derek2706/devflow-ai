import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const failureMessage =
  "Production backend configuration validation failed. Check Vercel Production variables and the compiled backend configuration module.";

export function validateProductionEnvironment(
  validate = () => require("../apps/server/dist/config/env.js").getEnv(),
) {
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "production") {
    return false;
  }
  try {
    // Load configuration only: no app, Prisma client, or database connection.
    validate();
  } catch {
    // Unexpected module errors may contain paths or values; keep logs fixed.
    throw new Error(failureMessage);
  }
  return true;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.info(
      validateProductionEnvironment()
        ? "Production backend configuration validated."
        : "Backend configuration validation skipped outside a Vercel production build.",
    );
  } catch {
    console.error(failureMessage);
    process.exitCode = 1;
  }
}
