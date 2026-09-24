/* eslint-disable @typescript-eslint/no-require-imports -- This server-only adapter loads the compiled CommonJS backend. */

/**
 * Adapt Express to a Next Pages API function without serializing its response.
 * The original request stream, response, and Set-Cookie array remain intact.
 * Waiting for finish/close keeps the function alive through async middleware.
 */
function createExpressBridge(
  loadApplication,
  reportError = () => {
    console.error("DevFlow AI API initialization or request handling failed.");
  },
) {
  return (request, response) =>
    new Promise((resolve) => {
      if (response.writableEnded || response.destroyed) {
        resolve();
        return;
      }
      const settled = () => {
        response.removeListener("finish", settled);
        response.removeListener("close", settled);
        response.removeListener("error", failed);
        resolve();
      };
      const failed = () => {
        reportError();
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
        const app = loadApplication();
        Promise.resolve(app(request, response)).catch(failed);
      } catch {
        failed();
      }
    });
}

function loadBackend() {
  // Configuration/origin validation lives in the backend and reads only trusted
  // deployment environment variables. No request Host is used as configuration.
  const { getEnv } = require("../server/dist/config/env.js");
  getEnv();
  // Node's module cache keeps one app and Prisma client per warm function.
  return require("../server/dist/app.js").default;
}

const handleApiRequest = createExpressBridge(loadBackend);
module.exports = { createExpressBridge, handleApiRequest };
