import assert from "node:assert/strict";
import { test } from "node:test";
import {
  migrationFailureMessage,
  productionMigrationUrl,
} from "./vercel-migrate.mjs";

const production = { VERCEL: "1", VERCEL_ENV: "production" };
const transaction =
  "postgresql://postgres.project:example-password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=10&sslmode=require&schema=public";

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
    assert.equal(
      productionMigrationUrl({ DATABASE_URL: transaction, ...env }),
      undefined,
    );
    assert.equal(
      productionMigrationUrl({ DIRECT_URL: "invalid", ...env }),
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

test("production still requires DIRECT_URL for other database providers", () => {
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

test("missing or empty DIRECT_URL derives the Supabase shared session pooler", () => {
  for (const protocol of ["postgresql:", "postgres:"]) {
    for (const direct of [undefined, ""]) {
      const runtime = transaction.replace("postgresql:", protocol);
      const environment = {
        ...production,
        DATABASE_URL: runtime,
        DIRECT_URL: direct,
      };
      const url = new URL(productionMigrationUrl(environment));
      assert.equal(url.protocol, protocol);
      assert.equal(url.hostname, "aws-0-ap-south-1.pooler.supabase.com");
      assert.equal(url.port, "5432");
      assert.equal(url.username, "postgres.project");
      assert.equal(url.password, "example-password");
      assert.equal(url.pathname, "/postgres");
      assert.deepEqual(
        [...url.searchParams],
        [
          ["sslmode", "require"],
          ["schema", "public"],
        ],
      );
      assert.equal(environment.DATABASE_URL, runtime);
    }
  }
});

test("an explicit migration connection is preferred and returned unchanged", () => {
  const direct =
    "postgresql://admin:other-password@db.example.test:5432/application?sslmode=require&connect_timeout=30";
  for (const runtime of [transaction, "not-a-database-url"]) {
    assert.equal(
      productionMigrationUrl({
        ...production,
        DIRECT_URL: direct,
        DATABASE_URL: runtime,
      }),
      direct,
    );
  }
});

test("malformed explicit overrides fail instead of using a valid fallback", () => {
  for (const direct of [
    " ",
    "invalid-secret-value",
    "https://example.test/database",
    "postgresql://user:bad%escape@db.example.test/database",
    "postgresql://user:secret@db.example.test/database#fragment",
  ]) {
    assert.throws(
      () =>
        productionMigrationUrl({
          ...production,
          DIRECT_URL: direct,
          DATABASE_URL: transaction,
        }),
      (error) => {
        assert.match(error.message, /Set DIRECT_URL/);
        assert.ok(!error.message.includes("invalid-secret-value"));
        assert.ok(!error.message.includes("example-password"));
        return true;
      },
    );
  }
});

test("fallback rejects unknown providers, unsupported modes and malformed URLs", () => {
  for (const runtime of [
    undefined,
    "",
    "invalid-secret-value",
    "https://aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
    "postgresql://user:secret@localhost:6543/postgres",
    "postgresql://user:secret@pooled.example.test:6543/postgres",
    "postgresql://user:secret@aws-0.pooler.supabase.com.evil.test:6543/postgres",
    "postgresql://user:secret@not-pooler.supabase.com:6543/postgres",
    "postgresql://user:secret@pooler.supabase.com:6543/postgres",
    "postgresql://user:secret@db.project.supabase.co:6543/postgres",
    transaction.replace(":6543", ":5432"),
    transaction.replace(":6543", ""),
    transaction.replace("example-password", ""),
    transaction.replace("example-password", "bad%escape"),
    `${transaction}&sslcert=bad%escape`,
    transaction.replace("/postgres?", "/?"),
    transaction.replace("/postgres?", "/postgres/other?"),
    `${transaction}#private-fragment`,
    ` ${transaction}`,
  ]) {
    assert.throws(
      () => productionMigrationUrl({ ...production, DATABASE_URL: runtime }),
      (error) => {
        assert.match(error.message, /Set DIRECT_URL/);
        assert.ok(!error.message.includes("invalid-secret-value"));
        assert.ok(!error.message.includes("example-password"));
        assert.ok(!error.message.includes("bad%escape"));
        return true;
      },
    );
  }
});

test("fallback preserves encoded credentials, TLS settings and database options", () => {
  const runtime =
    "postgresql://custom%2Erole.project:p%40ss%3Aword%2F%3F%23%25%2B@aws-1-eu-west-1.pooler.supabase.com:6543/custom%20database?sslmode=verify-full&sslcert=%2Fcerts%2Froot%20certificate.pem&sslaccept=strict&schema=private&connect_timeout=30";
  const source = new URL(runtime);
  const result = new URL(
    productionMigrationUrl({ ...production, DATABASE_URL: runtime }),
  );
  assert.equal(result.username, source.username);
  assert.equal(result.password, source.password);
  assert.equal(decodeURIComponent(result.password), "p@ss:word/?#%+");
  assert.equal(result.pathname, source.pathname);
  assert.equal(result.port, "5432");
  assert.deepEqual([...result.searchParams], [...source.searchParams]);
});

test("fallback rejects ambiguous endpoint overrides and invalid pooling flags", () => {
  for (const suffix of [
    "host=other.example.test",
    "hostaddr=127.0.0.1",
    "PORT=5432",
    "user=another-project",
    "password=another-secret",
    "dbname=another-database",
    "pgbouncer=maybe",
    "pgbouncer=false",
  ]) {
    assert.throws(
      () =>
        productionMigrationUrl({
          ...production,
          DATABASE_URL: `${transaction}&${suffix}`,
        }),
      /Set DIRECT_URL/,
    );
  }
});

test("migration failures expose recognized Prisma codes without raw output or URLs", () => {
  const privateDetails =
    "postgresql://private-user:private-password@private-host/database";
  for (const code of ["P1000", "P1001", "P3005", "P3018"]) {
    for (const stream of ["stderr", "stdout"]) {
      const message = migrationFailureMessage({
        [stream]: `\u001b[31mError: ${code}\u001b[0m\n${privateDetails}`,
      });
      assert.match(message, new RegExp(`\\(${code}\\)`));
      assert.ok(!message.includes("private-"));
      assert.ok(!message.includes("postgresql://"));
    }
  }
  assert.match(
    migrationFailureMessage({
      stderr: "Error code: P1011\nTLS private details",
    }),
    /\(P1011\)/,
  );
  for (const output of [
    `Error: P9999\n${privateDetails}`,
    `Connection to ${privateDetails} failed`,
    `Password contains P1000: ${privateDetails}`,
    "",
  ]) {
    const message = migrationFailureMessage({ stderr: output });
    assert.match(message, /^Production migrations failed\./);
    assert.ok(!message.includes("private-"));
  }
});
