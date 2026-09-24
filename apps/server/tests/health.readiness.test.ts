import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { setImmediate as nextTurn } from "node:timers/promises";
import { test } from "node:test";
import { createReadinessProbe } from "../src/modules/health/health.service";
import repository from "../src/modules/health/health.repository";

test("readiness shares concurrent probes and recovers after a failed probe", async () => {
  let queries = 0;
  let finish!: () => void;
  const query = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const check = createReadinessProbe(() => {
    queries++;
    return queries === 1
      ? query
      : Promise.reject(new Error("private DB details"));
  });
  const first = check();
  const second = check();
  assert.equal(first, second);
  finish();
  assert.equal(await first, true);
  assert.equal(queries, 1);
  assert.equal(await check(), false);
  assert.equal(queries, 2);

  let unavailable = true;
  const recovering = createReadinessProbe(async () => {
    if (unavailable) throw new Error("private DB details");
  });
  assert.equal(await recovering(), false);
  unavailable = false;
  assert.equal(await recovering(), true);
});

test("readiness deadlines do not accumulate queries or emit late unhandled rejections", async (context) => {
  let fail!: (reason: Error) => void;
  let queries = 0;
  const query = new Promise<void>((_resolve, reject) => {
    fail = reject;
  });
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on("unhandledRejection", onUnhandled);
  context.after(() => process.off("unhandledRejection", onUnhandled));
  const check = createReadinessProbe(() => {
    queries++;
    return query;
  }, 10);
  const started = Date.now();
  assert.equal(await check(), false);
  assert.ok(Date.now() - started < 1_000);
  for (let attempt = 0; attempt < 20; attempt++)
    assert.equal(await check(), false);
  assert.equal(queries, 1);
  fail(new Error("private late failure"));
  await nextTurn();
  assert.deepEqual(unhandled, []);
});

test("synchronous readiness failures are converted to unavailable", async () => {
  const check = createReadinessProbe(() => {
    throw new Error("private config");
  });
  assert.equal(await check(), false);
});

test("public readiness reports a safe 200 or 503 while liveness stays independent of the database", async (context) => {
  process.env.NODE_ENV = "test";
  let databaseAvailable = true;
  context.mock.method(repository, "probeDatabase", async () => {
    if (!databaseAvailable)
      throw new Error("postgresql://user:private-password@private-host/db");
    return [{ "?column?": 1 }];
  });
  const { default: app } = await import("../src/app");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal(app.get("trust proxy"), false);
    for (const path of ["/health/ready", "/api/health/ready"]) {
      const ready = await fetch(`${url}${path}`);
      assert.equal(ready.status, 200);
      assert.deepEqual(await ready.json(), {
        success: true,
        message: "DevFlow AI Backend Ready",
      });
      assert.equal(ready.headers.get("cache-control"), "no-store");
    }
    databaseAvailable = false;
    for (const path of ["/health/ready", "/api/health/ready"]) {
      const unavailable = await fetch(`${url}${path}`);
      assert.equal(unavailable.status, 503);
      assert.deepEqual(await unavailable.json(), {
        success: false,
        message: "Database is unavailable",
      });
      assert.equal(unavailable.headers.get("cache-control"), "no-store");
    }
    for (const path of ["/health", "/api/health"]) {
      const alive = await fetch(`${url}${path}`);
      assert.equal(alive.status, 200);
      assert.equal(alive.headers.get("cache-control"), "no-store");
    }
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
});
