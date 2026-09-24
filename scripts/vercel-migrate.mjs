import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function productionMigrationUrl(environment) {
  // Preview builds must never migrate the production database.
  if (environment.VERCEL !== "1" || environment.VERCEL_ENV !== "production") {
    return undefined;
  }
  const value = environment.DIRECT_URL;
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
      throw new Error();
    }
  } catch {
    throw new Error(
      "Set DIRECT_URL to the direct PostgreSQL connection in Vercel's Production environment.",
    );
  }
  return value;
}

export function migrate(environment = process.env) {
  const databaseUrl = productionMigrationUrl(environment);
  if (!databaseUrl) {
    console.info(
      "Database migrations skipped outside a Vercel production build.",
    );
    return;
  }
  console.info("Applying committed production database migrations.");
  const result = spawnSync(
    "pnpm",
    ["--filter", "server", "exec", "prisma", "migrate", "deploy"],
    {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
      env: { ...environment, DATABASE_URL: databaseUrl },
      encoding: "utf8",
      timeout: 120_000,
      // Raw database errors can contain deployment details. Keep credentials out of build logs.
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      "Production migrations failed. Check DIRECT_URL, database availability, and migration history before redeploying.",
    );
  }
  console.info("Production database migrations completed.");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    migrate();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
