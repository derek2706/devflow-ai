import express from "express";
import cors from "cors";

import { authRoutes } from "./modules/auth";
import { errorHandler } from "./shared/errors/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "DevFlow AI Backend Running",
  });
});

app.use("/api/auth", authRoutes);

app.use(errorHandler);

export default app;
