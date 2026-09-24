import { getEnv } from "./config/env";
import app from "./app";
import { prisma } from "./lib/prisma";
import { logger } from "./shared/logger/logger";

let server: ReturnType<typeof app.listen> | undefined;
let shuttingDown = false;

async function shutdown(reason: string, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ reason }, "Shutting down server");
  const deadline = setTimeout(() => {
    logger.error("Graceful shutdown exceeded its deadline");
    server?.closeAllConnections();
    process.exit(1);
  }, 10_000);
  deadline.unref();
  try {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
        server!.closeIdleConnections();
      });
    }
    await prisma.$disconnect();
    logger.info("Server shutdown complete");
  } catch {
    logger.error("Server shutdown failed");
    exitCode = 1;
  } finally {
    clearTimeout(deadline);
    process.exit(exitCode);
  }
}

async function start() {
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
    logger.level = env.NODE_ENV === "production" ? "info" : "debug";
  } catch (error) {
    logger.fatal(
      {
        validation:
          error instanceof Error ? error.message : "Invalid configuration",
      },
      "Server configuration is invalid",
    );
    await shutdown("Invalid configuration", 1);
    return;
  }
  try {
    await prisma.$connect();
    server = app.listen(env.PORT, () =>
      logger.info({ port: env.PORT }, "DevFlow AI API is listening"),
    );
    server.on("error", () => {
      logger.error("HTTP server failed to listen");
      void shutdown("HTTP server error", 1);
    });
  } catch {
    logger.error(
      "Database connection failed; check DATABASE_URL and database availability",
    );
    await shutdown("Startup failed", 1);
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("uncaughtException", () => {
  logger.fatal("Unhandled exception");
  void shutdown("Unhandled exception", 1);
});
process.once("unhandledRejection", () => {
  logger.fatal("Unhandled promise rejection");
  void shutdown("Unhandled promise rejection", 1);
});
void start();
