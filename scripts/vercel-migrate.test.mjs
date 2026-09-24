import assert from "node:assert/strict";
import { test } from "node:test";
import { productionMigrationUrl } from "./vercel-migrate.mjs";

test("only a Vercel production build selects a migration connection", () => {
  const direct = "postgresql://example.test/demo";
  for (const env of [
    {},
    { VERCEL_ENV: "production" },
    { VERCEL: "1", VERCEL_ENV: "preview" },
    { VERCEL: "1", VERCEL_ENV: "development" },
  ]) {
    assert.equal(
      productionMigrationUrl({ DIRECT_URL: direct, ...env }),
      undefined,
    );
  }
  assert.equal(
    productionMigrationUrl({
      VERCEL: "1",
      VERCEL_ENV: "production",
      DIRECT_URL: direct,
    }),
    direct,
  );
});

test("production requires a direct database URL and never falls back to the pooled runtime URL", () => {
  for (const value of [
    undefined,
    "",
    "invalid-secret-value",
    "https://example.test/database",
  ]) {
    assert.throws(
      () =>
        productionMigrationUrl({
          VERCEL: "1",
          VERCEL_ENV: "production",
          DATABASE_URL: "postgresql://pooled.example.test/demo",
          DIRECT_URL: value,
        }),
      (error) => {
        assert.match(error.message, /Set DIRECT_URL/);
        assert.ok(!error.message.includes("invalid-secret-value"));
        return true;
      },
    );
  }
});
