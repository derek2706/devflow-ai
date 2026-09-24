import { Router } from "express";
import { asyncHandler } from "../../shared/errors/asyncHandler";
import { validateQuery } from "../../shared/validation";
import controller from "./dashboard.controller";
import { dashboardQuerySchema } from "./dashboard.validation";

const router = Router();
router.get(
  "/dashboard",
  validateQuery(dashboardQuerySchema),
  asyncHandler(controller.get),
);
export default router;
