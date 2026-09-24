import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = fileURLToPath(new URL("./vercel-validate.mjs", import.meta.url));
const serverRequire = createRequire(
  new URL("../apps/server/package.json", import.meta.url),
);
const valid = {
  NODE_ENV: "production",
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_PROJECT_PRODUCTION_URL: "devflow-test.vercel.app",
  WEB_URL: "",
  CORS_ORIGINS: "",
  PORT: "5001",
  DATABASE_URL: "postgresql://test:test@127.0.0.1:1/not-connected",
  JWT_ACCESS_SECRET: "synthetic-access-secret-at-least-32-characters",
  JWT_REFRESH_SECRET: "synthetic-refresh-secret-at-least-32-characters",
  ACCESS_TOKEN_EXPIRY: "15m",
  REFRESH_TOKEN_EXPIRY: "7d",
  AI_MODE: "local",
  TRUST_VERCEL_PROXY: "true",
};

before(() => {
  // Exercise the same compiled validator used by production, even on a fresh clone.
  const result = spawnSync(
    process.execPath,
    [
      serverRequire.resolve("typescript/bin/tsc"),
      "-p",
      "apps/server/tsconfig.json",
    ],
    { cwd: root, encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(result.status, 0, "Backend compilation for guard tests failed");
});

function run(overrides = {}, source) {
  return spawnSync(
    process.execPath,
    source ? ["--input-type=module", "-e", source] : [script],
    {
      cwd: fileURLToPath(new URL("./", import.meta.url)),
      env: { ...valid, ...overrides },
      encoding: "utf8",
      timeout: 5_000,
    },
  );
}

test("local and preview builds skip invalid or missing production configuration", () => {
  for (const environment of [
    { VERCEL: undefined, VERCEL_ENV: undefined },
    { VERCEL: undefined, VERCEL_ENV: "production" },
    { VERCEL: "1", VERCEL_ENV: "preview" },
    { VERCEL: "1", VERCEL_ENV: "development" },
  ]) {
    const result = run({
      ...environment,
      DATABASE_URL: "invalid",
      JWT_ACCESS_SECRET: "short",
      PORT: "",
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /skipped outside a Vercel production build/);
    assert.equal(result.stderr, "");
  }
});

test("production validates real backend configuration without connecting to a database", () => {
  const result = run();
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "Production backend configuration validated.\n");
  assert.equal(result.stderr, "");
});

test("the real validator rejects invalid ports, short secrets and blank token lifetimes", () => {
  for (const overrides of [
    { PORT: "" },
    { PORT: "70000" },
    { JWT_ACCESS_SECRET: "private-short-access" },
    { JWT_REFRESH_SECRET: "private-short-refresh" },
    { ACCESS_TOKEN_EXPIRY: "" },
    { REFRESH_TOKEN_EXPIRY: "" },
  ]) {
    const result = run(overrides);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /^Production backend configuration validation failed\./,
    );
    assert.ok(!result.stderr.includes("private-short"));
    assert.ok(!result.stderr.includes("synthetic-"));
    assert.ok(!result.stderr.includes("postgresql://"));
    assert.equal(result.stdout, "");
  }
});

test("the real validator requires a valid trusted production origin", () => {
  for (const hostname of [
    undefined,
    "https://devflow-test.vercel.app",
    "invalid/path",
  ]) {
    assert.equal(run({ VERCEL_PROJECT_PRODUCTION_URL: hostname }).status, 1);
  }
  assert.equal(run({ WEB_URL: "http://insecure.example.test" }).status, 1);
  assert.equal(run({ WEB_URL: "https://custom.example.test" }).status, 0);
});

test("unexpected validation failures cannot print arbitrary messages or secrets", () => {
  const source = `
    import { validateProductionEnvironment } from ${JSON.stringify(new URL("./vercel-validate.mjs", import.meta.url).href)};
    try {
      validateProductionEnvironment(() => { throw new Error("private-password postgres://private-host"); });
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  `;
  const result = run({}, source);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /^Production backend configuration validation failed\./,
  );
  assert.ok(!result.stderr.includes("private-"));
  assert.ok(!result.stderr.includes("postgres://"));
});

test("production build validates after server compilation and before database migrations", () => {
  const { scripts } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const steps = scripts["build:vercel"].split(" && ");
  const compile = steps.indexOf("pnpm --filter server build");
  const validate = steps.indexOf("node scripts/vercel-validate.mjs");
  const migrate = steps.indexOf("node scripts/vercel-migrate.mjs");
  assert.ok(compile >= 0 && compile < validate && validate < migrate);
});
