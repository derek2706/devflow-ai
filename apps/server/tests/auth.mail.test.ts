import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, mock, test } from "node:test";
import { mailer } from "../src/lib/mail";

let directory: string;
const original = { ...process.env };
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "devflow-mail-test-"));
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    JWT_ACCESS_SECRET: "test-mail-access-secret-at-least-thirty-two-characters",
    JWT_REFRESH_SECRET:
      "test-mail-refresh-secret-at-least-thirty-two-characters",
    ACCESS_TOKEN_EXPIRY: "15m",
    REFRESH_TOKEN_EXPIRY: "7d",
    AI_MODE: "local",
    MAIL_PREVIEW_DIR: directory,
  });
});
after(async () => {
  mock.restoreAll();
  for (const key of Object.keys(process.env))
    if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
  await rm(directory, { recursive: true, force: true });
});

test("development/test mail stays local even when a provider key is present", async () => {
  process.env.NODE_ENV = "test";
  process.env.RESEND_API_KEY = "test-provider-key-do-not-send";
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected external email call");
  });
  const message = {
    to: "preview@example.com",
    subject: "Preview",
    text: "A local-only test message",
  };
  await mailer.send(message);
  assert.equal(fetchMock.mock.callCount(), 0);
  const files = await readdir(directory);
  assert.equal(files.length, 1);
  assert.deepEqual(
    JSON.parse(await readFile(join(directory, files[0]), "utf8")),
    message,
  );
  fetchMock.mock.restore();
});

test("production mail fails closed without provider configuration", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.RESEND_API_KEY;
  await assert.rejects(
    mailer.send({
      to: "preview@example.com",
      subject: "No send",
      text: "Unavailable",
    }),
    /not configured/,
  );
});
