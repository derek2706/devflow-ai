/* eslint-disable @typescript-eslint/no-require-imports -- API regressions run directly in Node.js. */
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const test = require("node:test");

const serverRequire = createRequire(
  require.resolve("../../server/package.json"),
);
const { require: requireTypeScript } = serverRequire("tsx/cjs/api");
const { api, ApiError } = requireTypeScript("../src/lib/api.ts", __filename);

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

test("concurrent expired requests share one in-flight refresh", async (t) => {
  const started = deferred();
  const finish = deferred();
  const attempts = new Map();
  let refreshes = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshes += 1;
      started.resolve();
      await finish.promise;
      return json({});
    }
    const attempt = (attempts.get(url) || 0) + 1;
    attempts.set(url, attempt);
    return attempt === 1
      ? json({ message: "Expired" }, 401)
      : json({ data: { ok: true } });
  });

  const first = api("/test/first");
  const second = api("/test/second");
  await started.promise;
  finish.resolve();
  assert.deepEqual(await Promise.all([first, second]), [
    { ok: true },
    { ok: true },
  ]);
  assert.equal(refreshes, 1);
  assert.deepEqual([...attempts.values()], [2, 2]);
});

test("a late 401 reuses a completed refresh and preserves write options", async (t) => {
  const late = deferred();
  const attempts = new Map();
  const writeOptions = [];
  let refreshes = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshes += 1;
      return json({});
    }
    const attempt = (attempts.get(url) || 0) + 1;
    attempts.set(url, attempt);
    if (String(url).endsWith("/test/late")) writeOptions.push(options);
    if (attempt === 1) {
      if (String(url).endsWith("/test/late")) await late.promise;
      return json({ message: "Expired" }, 401);
    }
    return json({ data: { ok: true } });
  });

  const first = api("/test/fast");
  const controller = new AbortController();
  const second = api("/test/late", {
    method: "PATCH",
    body: JSON.stringify({ title: "Updated" }),
    signal: controller.signal,
  });
  await first;
  late.resolve();
  assert.deepEqual(await second, { ok: true });
  assert.equal(refreshes, 1);
  assert.deepEqual([...attempts.values()], [2, 2]);
  assert.equal(writeOptions.length, 2);
  for (const options of writeOptions) {
    assert.equal(options.method, "PATCH");
    assert.equal(options.body, '{"title":"Updated"}');
    assert.equal(options.signal, controller.signal);
    assert.equal(options.credentials, "include");
  }
});

test("late failures do not repeat a refresh that already rejected the session", async (t) => {
  const late = deferred();
  let refreshes = 0;
  let resourceRequests = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshes += 1;
      return json({ message: "Invalid session" }, 401);
    }
    resourceRequests += 1;
    if (String(url).endsWith("/test/late")) await late.promise;
    return json({ message: "Expired" }, 401);
  });

  const first = assert.rejects(
    api("/test/fast"),
    (error) => error instanceof ApiError && error.status === 401,
  );
  const second = api("/test/late");
  await first;
  late.resolve();
  await assert.rejects(
    second,
    (error) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(refreshes, 1);
  assert.equal(resourceRequests, 2);
});

test("an unsuccessful retry stops after one refresh and auth endpoints never refresh", async (t) => {
  let refreshes = 0;
  let resourceRequests = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshes += 1;
      return json({});
    }
    resourceRequests += 1;
    return json({ message: "Unauthorized" }, 401);
  });

  await assert.rejects(
    api("/test/protected"),
    (error) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(refreshes, 1);
  assert.equal(resourceRequests, 2);
  for (const path of ["/auth/login", "/auth/register", "/auth/logout"]) {
    await assert.rejects(
      api(path),
      (error) => error instanceof ApiError && error.status === 401,
    );
  }
  assert.equal(refreshes, 1);
});
