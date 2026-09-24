import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

function postgresConnection(value) {
  if (typeof value !== "string" || /[\u0000-\u0020\u007f]/.test(value)) {
    throw new Error();
  }
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    url.hash
  ) {
    throw new Error();
  }
  // URL accepts malformed percent escapes, but database credentials must not.
  for (const part of [url.username, url.password, url.pathname, url.search]) {
    decodeURIComponent(part);
  }
  return url;
}

function supabaseSessionConnection(value) {
  const url = postgresConnection(value);
  const sharedPooler =
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+pooler\.supabase\.com$/i;
  if (
    !sharedPooler.test(url.hostname) ||
    url.hostname.length > 253 ||
    url.port !== "6543" ||
    !url.username ||
    !url.password ||
    !/^\/[^/]+$/.test(url.pathname)
  ) {
    throw new Error();
  }
  // Do not derive a connection whose query string could select another endpoint.
  const endpointOptions = new Set([
    "host",
    "hostaddr",
    "port",
    "user",
    "password",
    "dbname",
  ]);
  if (
    [...url.searchParams.keys()].some((key) =>
      endpointOptions.has(key.toLowerCase()),
    ) ||
    url.searchParams
      .getAll("pgbouncer")
      .some((mode) => !["true", "false"].includes(mode)) ||
    url.searchParams.getAll("pgbouncer").length > 1
  ) {
    throw new Error();
  }
  // Supabase's shared session/transaction strings differ only by this port.
  // Preserve credentials, database, TLS, schema and connection timeouts.
  url.port = "5432";
  for (const option of ["pgbouncer", "connection_limit", "pool_timeout"]) {
    url.searchParams.delete(option);
  }
  return url.toString();
}

export function productionMigrationUrl(environment) {
  // Preview builds must never migrate the production database.
  if (environment.VERCEL !== "1" || environment.VERCEL_ENV !== "production") {
    return undefined;
  }
  const value = environment.DIRECT_URL;
  try {
    // Only missing/empty values use the fallback. An invalid explicit override
    // must fail rather than silently migrating a different database.
    if (value !== undefined && value !== "") {
      postgresConnection(value);
      return value;
    }
    return supabaseSessionConnection(environment.DATABASE_URL);
  } catch {
    throw new Error(
      "Set DIRECT_URL to a PostgreSQL migration connection, or DATABASE_URL to a Supabase shared transaction pooler URL on port 6543, in Vercel's Production environment.",
    );
  }
}

export function migrationFailureMessage(result) {
  const output = stripVTControlCharacters(
    `${result.stderr ?? ""}\n${result.stdout ?? ""}`,
  );
  // Emit only a documented Prisma connection/schema-engine code, never its
  // accompanying message, which can contain credentials or database details.
  const code = output.match(
    /(?:^|\n)\s*(?:Error|Error code):\s*(P(?:100[0-3]|100[89]|101[0-7]|30[01]\d))\b/,
  )?.[1];
  return `Production migrations failed${code ? ` (${code})` : ""}. Check the migration connection (DIRECT_URL or Supabase DATABASE_URL), database availability, and migration history before redeploying.`;
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
    throw new Error(migrationFailureMessage(result));
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
