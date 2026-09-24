/* eslint-disable @typescript-eslint/no-require-imports -- Bridge tests run directly in Node.js. */
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createServer } = require("node:http");
const { createRequire } = require("node:module");
const { parse: parseQuery } = require("node:querystring");
const test = require("node:test");
const { apiResolver } = require("next/dist/server/api-utils/node/api-resolver");
const serverRequire = createRequire(
  require.resolve("../../server/package.json"),
);
const express = serverRequire("express");
const { require: requireTypeScript } = serverRequire("tsx/cjs/api");
// Load the real validation layer without importing the app, Prisma, or compiled
// artifacts, so these regressions also run from a clean checkout.
const { dashboardQuerySchema } = requireTypeScript(
  "../../server/src/modules/dashboard/dashboard.validation.ts",
  __filename,
);
const { validateQuery } = requireTypeScript(
  "../../server/src/shared/validation.ts",
  __filename,
);
const {
  createBackendLoader,
  createExpressBridge,
} = require("../api-bridge.cjs");
const {
  developmentApiRewrites,
  getApiInternalOrigin,
} = require("../api-rewrite.cjs");

function sampleApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1kb" }));
  app.post("/api/echo", (request, response) => {
    response.cookie("access_token", "test-access", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    response.cookie("refresh_token", "test-refresh", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/auth",
    });
    response.status(201).set("X-Express-Route", "echo").json({
      success: true,
      url: request.url,
      method: request.method,
      cookie: request.cookies?.existing,
      query: request.query.view,
      data: request.body,
    });
  });
  app.post("/api/auth/logout", (_request, response) => {
    response.clearCookie("access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    response.clearCookie("refresh_token", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/auth",
    });
    response.status(200).json({ success: true });
  });
  app.delete("/api/task", (_request, response) => response.status(204).end());
  app.get("/api/async-error", async () => {
    await Promise.resolve();
    throw Object.assign(new Error("Private diagnostic"), { status: 409 });
  });
  app.use((_request, response) =>
    response.status(404).json({ success: false, message: "Route not found" }),
  );
  app.use((error, _request, response, next) => {
    if (response.headersSent) return next(error);
    response
      .status(error.status || 500)
      .set("X-Handled-By", "Express")
      .json({
        success: false,
        message: error.status === 409 ? "Conflict" : "Invalid request",
      });
  });
  return app;
}

async function serve(context, bridge) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const query = parseQuery(url.search.slice(1));
    if (url.pathname !== "/api") query.path = url.pathname.slice(5).split("/");
    // Exercise the actual Next API resolver's decorated req/res, cookie parser,
    // response helpers and disabled body parser, rather than a mock Next layer.
    void apiResolver(
      request,
      response,
      query,
      {
        default: bridge,
        config: { api: { bodyParser: false, externalResolver: true } },
      },
      {
        previewModeId: "test",
        previewModeEncryptionKey: "test",
        previewModeSigningKey: "test",
        dev: false,
      },
      true,
    ).catch(() => {
      if (!response.writableEnded) response.destroy();
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeIdleConnections();
    });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test("Next-to-Express bridge preserves body, URL, status, response headers, and separate session cookies", async (context) => {
  const app = sampleApp();
  const origin = await serve(
    context,
    createExpressBridge(() => app),
  );
  const body = { title: "Ship the release", labels: ["backend", "release"] };
  const response = await fetch(`${origin}/api/echo?view=board`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "existing=browser-cookie",
    },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("x-express-route"), "echo");
  assert.match(response.headers.get("content-type"), /application\/json/);
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.match(
    cookies[0],
    /^access_token=test-access; Path=\/; HttpOnly; Secure; SameSite=Lax$/,
  );
  assert.match(
    cookies[1],
    /^refresh_token=test-refresh; Path=\/api\/auth; HttpOnly; Secure; SameSite=Lax$/,
  );
  assert.deepEqual(await response.json(), {
    success: true,
    url: "/api/echo?view=board",
    method: "POST",
    cookie: "browser-cookie",
    query: "board",
    data: body,
  });
});

function dashboardQueryApp() {
  const app = express();
  app.get(
    "/api/dashboard",
    validateQuery(dashboardQuerySchema),
    (request, response) =>
      response.json({
        success: true,
        query: response.locals.validatedQuery,
        url: request.url,
      }),
  );
  return app;
}

test("dashboard validation accepts empty and workspace queries without Next catch-all metadata", async (context) => {
  const app = dashboardQueryApp();
  const origin = await serve(
    context,
    createExpressBridge(() => app),
  );
  const workspaceId = "420ce36a-447f-4945-a6ea-f7ea518d108a";
  for (const [search, query] of [
    ["", {}],
    [`?workspaceId=${workspaceId}`, { workspaceId }],
  ]) {
    const response = await fetch(`${origin}/api/dashboard${search}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      query,
      url: `/api/dashboard${search}`,
    });
  }
});

// This tests the URL received by the adapter. The full Next server can consume
// its reserved catch-all parameter name before invoking the API resolver.
test("dashboard still rejects caller-supplied path parameters after removing Next route metadata", async (context) => {
  const app = dashboardQueryApp();
  const origin = await serve(
    context,
    createExpressBridge(() => app),
  );
  for (const search of ["?path=caller-value", "?path=first&path=second"]) {
    const response = await fetch(`${origin}/api/dashboard${search}`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.message, "Invalid query parameters");
    assert.deepEqual(
      body.errors.map(({ code, keys }) => ({ code, keys })),
      [{ code: "unrecognized_keys", keys: ["path"] }],
    );
  }
});

test("Express's configured parser retains repeated, encoded, and nested query semantics", async (context) => {
  const search =
    "?tags=frontend&tags=api&search=C%2B%2B+tools&filter%5Bstatus%5D=open&filters%5Blabels%5D%5B%5D=one&filters%5Blabels%5D%5B%5D=two&empty=";
  for (const [parser, expected] of [
    [
      "simple",
      {
        tags: ["frontend", "api"],
        search: "C++ tools",
        "filter[status]": "open",
        "filters[labels][]": ["one", "two"],
        empty: "",
      },
    ],
    [
      "extended",
      {
        tags: ["frontend", "api"],
        search: "C++ tools",
        filter: { status: "open" },
        filters: { labels: ["one", "two"] },
        empty: "",
      },
    ],
  ]) {
    const app = express();
    app.set("query parser", parser);
    app.get("/api/query", (request, response) =>
      response.json({
        query: request.query,
        url: request.url,
      }),
    );
    const origin = await serve(
      context,
      createExpressBridge(() => app),
    );
    const response = await fetch(`${origin}/api/query${search}`);
    assert.equal(response.status, 200);
    assert.deepEqual(
      await response.json(),
      {
        query: expected,
        url: `/api/query${search}`,
      },
      `${parser} query parser`,
    );
  }
});

test("logout cookie expiration reaches the browser without merging Set-Cookie", async (context) => {
  const app = sampleApp();
  const origin = await serve(
    context,
    createExpressBridge(() => app),
  );
  const response = await fetch(`${origin}/api/auth/logout`, { method: "POST" });
  assert.equal(response.status, 200);
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.match(
    cookies[0],
    /^access_token=; Path=\/; Expires=Thu, 01 Jan 1970 00:00:00 GMT;/,
  );
  assert.match(
    cookies[1],
    /^refresh_token=; Path=\/api\/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT;/,
  );
  assert.deepEqual(await response.json(), { success: true });
});

test("Express owns malformed JSON and body-size errors", async (context) => {
  const app = sampleApp();
  const origin = await serve(
    context,
    createExpressBridge(() => app),
  );
  for (const [body, status] of [
    ["{bad-json", 400],
    [JSON.stringify({ value: "x".repeat(1100) }), 413],
  ]) {
    const response = await fetch(`${origin}/api/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("x-handled-by"), "Express");
    assert.deepEqual(await response.json(), {
      success: false,
      message: "Invalid request",
    });
  }
});

test("Express asynchronous errors, 404s and empty 204 responses are preserved", async (context) => {
  const app = sampleApp();
  const origin = await serve(
    context,
    createExpressBridge(() => app),
  );
  const errorResponse = await fetch(`${origin}/api/async-error`);
  assert.equal(errorResponse.status, 409);
  assert.equal(errorResponse.headers.get("x-handled-by"), "Express");
  assert.deepEqual(await errorResponse.json(), {
    success: false,
    message: "Conflict",
  });
  for (const path of ["/api", "/api/not-found"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      success: false,
      message: "Route not found",
    });
  }
  const empty = await fetch(`${origin}/api/task`, { method: "DELETE" });
  assert.equal(empty.status, 204);
  assert.equal(await empty.text(), "");
});

test("configuration/loading failures return a generic error without exposing secrets", async (context) => {
  let reported = 0;
  const origin = await serve(
    context,
    createExpressBridge(
      () => {
        throw new Error(
          "postgresql://private-user:private-password@db/private",
        );
      },
      () => {
        reported += 1;
      },
    ),
  );
  const response = await fetch(`${origin}/api/auth/login`, { method: "POST" });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "Internal server error",
  });
  assert.equal(reported, 1);
});

test("initialization diagnostics identify each backend loading stage without logging values", async (context) => {
  const cases = [
    {
      dependencies: {
        loadEnvironment: () => {
          throw Object.assign(
            new Error(
              "Cannot find module 'dotenv'\nRequire stack: /private/secret",
            ),
            { code: "MODULE_NOT_FOUND" },
          );
        },
      },
      expected: {
        stage: "environment-module",
        errorName: "Error",
        errorCode: "MODULE_NOT_FOUND",
        module: "dotenv",
      },
    },
    {
      dependencies: {
        loadEnvironment: () => ({
          getEnv: () => {
            throw new Error(
              "Invalid environment configuration: DATABASE_URL, JWT_ACCESS_SECRET, CORS_ORIGINS.0, DATABASE_URL postgresql://private:secret@db/private UNKNOWN_SECRET",
            );
          },
        }),
      },
      expected: {
        stage: "environment-validation",
        errorName: "Error",
        configurationKeys: [
          "DATABASE_URL",
          "JWT_ACCESS_SECRET",
          "CORS_ORIGINS",
        ],
      },
    },
    {
      dependencies: {
        loadEnvironment: () => ({ getEnv: () => ({}) }),
        loadApplication: () => {
          throw Object.assign(new Error("/private/secret/native.node failed"), {
            code: "ERR_DLOPEN_FAILED",
          });
        },
      },
      expected: {
        stage: "application-module",
        errorName: "Error",
        errorCode: "ERR_DLOPEN_FAILED",
      },
    },
  ];
  for (const { dependencies, expected } of cases) {
    const diagnostics = [];
    const origin = await serve(
      context,
      createExpressBridge(createBackendLoader(dependencies), (diagnostic) =>
        diagnostics.push(diagnostic),
      ),
    );
    const response = await fetch(`${origin}/api/health`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      success: false,
      message: "Internal server error",
    });
    assert.deepEqual(diagnostics, [expected]);
  }
});

test("request diagnostics retain safe Prisma codes and preserve separate cookies on a generic 500", async (context) => {
  const diagnostics = [];
  const cookies = [
    "access_token=; Path=/; HttpOnly",
    "refresh_token=; Path=/api/auth; HttpOnly",
  ];
  const origin = await serve(
    context,
    createExpressBridge(
      createBackendLoader({
        loadEnvironment: () => ({ getEnv: () => ({}) }),
        loadApplication: () => ({
          default: async (_request, response) => {
            response.setHeader("Set-Cookie", cookies);
            throw Object.assign(
              new Error("postgresql://user:secret@db/private"),
              {
                name: "PrismaClientInitializationError",
                errorCode: "P1001",
              },
            );
          },
        }),
      }),
      (diagnostic) => diagnostics.push(diagnostic),
    ),
  );
  const response = await fetch(`${origin}/api/auth/login`, { method: "POST" });
  assert.equal(response.status, 500);
  assert.deepEqual(response.headers.getSetCookie(), cookies);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "Internal server error",
  });
  assert.deepEqual(diagnostics, [
    {
      stage: "request-handling",
      errorName: "PrismaClientInitializationError",
      errorCode: "P1001",
    },
  ]);
});

test("default diagnostics exclude arbitrary names, codes, messages, stacks, module paths, and request data", async (context) => {
  const logs = [];
  context.mock.method(console, "error", (...args) => logs.push(args));
  for (const [error, expected] of [
    [
      Object.assign(new Error("postgresql://user:secret@db/private"), {
        name: "private-error-name",
        code: "private-error-code",
        stack: "private-stack",
      }),
      { stage: "request-handling", errorName: "UnknownError" },
    ],
    [
      Object.assign(
        new Error("Cannot find module '/private/secret/module.js'"),
        {
          code: "MODULE_NOT_FOUND",
        },
      ),
      {
        stage: "request-handling",
        errorName: "Error",
        errorCode: "MODULE_NOT_FOUND",
      },
    ],
  ]) {
    const origin = await serve(
      context,
      createExpressBridge(() => () => {
        throw error;
      }),
    );
    const response = await fetch(`${origin}/api/auth/login?secret=query`, {
      method: "POST",
      headers: {
        Authorization: "Bearer private-auth-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "private-body-password" }),
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      success: false,
      message: "Internal server error",
    });
    assert.deepEqual(logs.at(-1), ["DevFlow AI API failure.", expected]);
  }
  assert.equal(logs.length, 2);
});

test("bridge awaits response completion rather than Express's immediate return", async () => {
  const response = new EventEmitter();
  const request = { url: "/api/tasks" };
  let received;
  const bridge = createExpressBridge(() => (req, res) => {
    received = [req, res];
  });
  let completed = false;
  const pending = bridge(request, response).then(() => {
    completed = true;
  });
  await Promise.resolve();
  assert.deepEqual(received, [request, response]);
  assert.equal(completed, false);
  response.emit("finish");
  await pending;
  assert.equal(completed, true);
  assert.equal(response.listenerCount("finish"), 0);
  assert.equal(response.listenerCount("close"), 0);
  assert.equal(response.listenerCount("error"), 0);
});

test("client disconnect settles the function and removes response listeners", async () => {
  const response = new EventEmitter();
  const pending = createExpressBridge(() => () => {})(
    { url: "/api/tasks" },
    response,
  );
  response.emit("close");
  await pending;
  assert.equal(response.listenerCount("finish"), 0);
  assert.equal(response.listenerCount("error"), 0);
});

test("development targets the independent API while production never proxies externally", () => {
  assert.deepEqual(developmentApiRewrites({ NODE_ENV: "development" }), [
    { source: "/api/:path*", destination: "http://127.0.0.1:5001/api/:path*" },
  ]);
  assert.deepEqual(
    developmentApiRewrites({
      NODE_ENV: "development",
      API_INTERNAL_URL: "http://api.internal:5001/",
    }),
    [
      {
        source: "/api/:path*",
        destination: "http://api.internal:5001/api/:path*",
      },
    ],
  );
  assert.deepEqual(
    developmentApiRewrites({
      NODE_ENV: "production",
      API_INTERNAL_URL: "https://unused.example.com",
    }),
    [],
  );
  assert.deepEqual(developmentApiRewrites({ NODE_ENV: "test" }), []);
});

test("development API origins reject paths, credentials, fragments and non-HTTP schemes", () => {
  assert.equal(
    getApiInternalOrigin("http://api.internal:5001/"),
    "http://api.internal:5001",
  );
  for (const value of [
    "",
    "//attacker.example",
    "https://user:secret@api.example.com",
    "http://localhost:5001/api",
    "http://localhost:5001?x=1",
    "http://localhost:5001#test",
    "ftp://api.example.com",
  ]) {
    assert.throws(
      () => getApiInternalOrigin(value),
      /Invalid API_INTERNAL_URL configuration/,
    );
  }
});
