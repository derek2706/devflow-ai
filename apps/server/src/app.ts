import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { isAllowedOrigin } from "./config/origins";
import { authRoutes } from "./modules/auth";
import workspacesRoutes from "./modules/workspaces/workspaces.routes";
import projectsRoutes from "./modules/projects/projects.routes";
import tasksRoutes from "./modules/tasks/tasks.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import aiRoutes from "./modules/ai/ai.routes";
import { requireAuth } from "./middlewares/requireAuth";
import {
  rateLimit,
  securityHeaders,
  verifyOrigin,
} from "./middlewares/security";
import { logger } from "./shared/logger/logger";
import { HTTP_STATUS } from "./shared/constants/http-status";
import { errorHandler } from "./shared/errors/errorHandler";

const app = express();

app.disable("x-powered-by");
app.use(securityHeaders);
app.use(
  pinoHttp({
    logger,
    autoLogging: process.env.NODE_ENV !== "test",
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url?.split("?")[0],
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);
app.use(
  cors({
    origin: (origin, callback) =>
      callback(null, !origin || isAllowedOrigin(origin)),
    credentials: true,
  }),
);
app.use(verifyOrigin);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "DevFlow AI Backend Running",
  });
});

app.use(
  [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
  ],
  rateLimit(30, 15 * 60_000),
);
app.use("/api/auth/refresh", rateLimit(120, 60_000));
app.use("/api/auth", authRoutes);
app.use("/api", requireAuth, rateLimit(600, 60_000));
app.use("/api", workspacesRoutes, projectsRoutes, tasksRoutes, dashboardRoutes);
app.use("/api/ai", rateLimit(20, 60_000), aiRoutes);

app.use((_req, res) =>
  res
    .status(HTTP_STATUS.NOT_FOUND)
    .json({ success: false, message: "Route not found" }),
);

app.use(errorHandler);

export default app;
