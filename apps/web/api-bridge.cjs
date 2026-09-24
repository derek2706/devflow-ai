/* eslint-disable @typescript-eslint/no-require-imports -- This server-only adapter loads the compiled CommonJS backend. */

const failureStages = new Set([
  "environment-module",
  "environment-validation",
  "application-module",
  "request-handling",
]);
const errorNames = new Set([
  "Error",
  "TypeError",
  "SyntaxError",
  "ReferenceError",
  "RangeError",
  "URIError",
  "AggregateError",
  "ZodError",
  "PrismaClientInitializationError",
  "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError",
  "PrismaClientRustPanicError",
  "PrismaClientValidationError",
]);
const errorCodes = new Set([
  "MODULE_NOT_FOUND",
  "ERR_MODULE_NOT_FOUND",
  "ERR_DLOPEN_FAILED",
  "ERR_PACKAGE_PATH_NOT_EXPORTED",
  "ERR_REQUIRE_ESM",
  "ENOENT",
  "EACCES",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
]);
const configurationKeys = new Set([
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "WEB_URL",
  "CORS_ORIGINS",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "ACCESS_TOKEN_EXPIRY",
  "REFRESH_TOKEN_EXPIRY",
  "API_COOKIE_SECURE",
  "TRUST_VERCEL_PROXY",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "MAIL_PREVIEW_DIR",
  "AI_MODE",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
]);
const moduleIdentifiers = new Set([
  "../server/dist/config/env.js",
  "../server/dist/app.js",
  "@prisma/client",
  ".prisma/client/default",
  "bcrypt",
  "cookie-parser",
  "cors",
  "dotenv",
  "express",
  "helmet",
  "jsonwebtoken",
  "pino",
  "pino-http",
  "resend",
  "zod",
]);

function errorString(error, key) {
  // Error properties can be overridden, including by throwing getters.
  try {
    const value = error?.[key];
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function failureDiagnostic(error, stage) {
  const name = errorString(error, "name");
  const code = errorString(error, "code") ?? errorString(error, "errorCode");
  const diagnostic = {
    stage: failureStages.has(stage) ? stage : "application-module",
    errorName: errorNames.has(name) ? name : "UnknownError",
  };
  // Prisma's documented codes have a fixed Pdddd shape. Arbitrary strings,
  // including user-defined error names/codes, are never written to logs.
  if (errorCodes.has(code) || (code && /^P\d{4}$/.test(code))) {
    diagnostic.errorCode = code;
  }
  const message = errorString(error, "message");
  if (
    diagnostic.stage === "environment-validation" &&
    message?.startsWith("Invalid environment configuration:")
  ) {
    diagnostic.configurationKeys = [
      ...new Set(
        (message.match(/\b[A-Z][A-Z0-9_]*\b/g) ?? []).filter((key) =>
          configurationKeys.has(key),
        ),
      ),
    ];
  }
  if (code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND") {
    const identifier = message?.match(
      /^Cannot find (?:module|package) ['"]([^'"\r\n]+)['"]/,
    )?.[1];
    if (moduleIdentifiers.has(identifier)) {
      diagnostic.module = identifier;
    }
  }
  return diagnostic;
}

/**
 * Adapt Express to a Next Pages API function without serializing its response.
 * The original request stream, response, and Set-Cookie array remain intact.
 * Waiting for finish/close keeps the function alive through async middleware.
 */
function createExpressBridge(
  loadApplication,
  reportError = (diagnostic) => {
    console.error("DevFlow AI API failure.", diagnostic);
  },
) {
  return (request, response) =>
    new Promise((resolve) => {
      if (response.writableEnded || response.destroyed) {
        resolve();
        return;
      }
      let stage = "application-module";
      const settled = () => {
        response.removeListener("finish", settled);
        response.removeListener("close", settled);
        response.removeListener("error", failed);
        resolve();
      };
      const failed = (error) => {
        try {
          reportError(failureDiagnostic(error, stage));
        } catch {
          // A logging failure must not prevent the generic error response.
        }
        if (response.writableEnded || response.destroyed) {
          settled();
        } else if (response.headersSent) {
          response.destroy();
        } else {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(
            JSON.stringify({
              success: false,
              message: "Internal server error",
            }),
          );
        }
      };
      response.once("finish", settled);
      response.once("close", settled);
      response.once("error", failed);
      try {
        const app = loadApplication((nextStage) => {
          stage = nextStage;
        });
        stage = "request-handling";
        // Next's own query object includes route parameters such as catch-all
        // `path`, shadowing Express 5's getter. Let Express parse the original
        // URL so only real query parameters reach validation (including any
        // caller-supplied `path`, which must still be validated normally).
        delete request.query;
        Promise.resolve(app(request, response)).catch(failed);
      } catch (error) {
        failed(error);
      }
    });
}

function createBackendLoader({
  loadEnvironment = () => require("../server/dist/config/env.js"),
  loadApplication = () => require("../server/dist/app.js"),
} = {}) {
  return (setStage) => {
    setStage("environment-module");
    const { getEnv } = loadEnvironment();
    // Configuration/origin validation reads only trusted deployment variables.
    // No request Host is used as configuration.
    setStage("environment-validation");
    getEnv();
    setStage("application-module");
    // Literal require paths above remain statically traceable by Next. Node's
    // module cache keeps one app and Prisma client per warm function.
    const app = loadApplication().default;
    if (typeof app !== "function") throw new TypeError();
    return app;
  };
}

const handleApiRequest = createExpressBridge(createBackendLoader());
module.exports = { createBackendLoader, createExpressBridge, handleApiRequest };
