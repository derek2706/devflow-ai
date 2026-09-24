import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../shared/errors/asyncHandler";
import controller from "./ai.controller";
import {
  subtasksSchema,
  summarySchema,
  sprintSchema,
  standupSchema,
} from "./ai.validation";

const router = Router();
router.get("/status", controller.status);
router.post(
  "/subtasks",
  validate(subtasksSchema),
  asyncHandler(controller.subtasks),
);
router.post(
  "/project-summary",
  validate(summarySchema),
  asyncHandler(controller.projectSummary),
);
router.post(
  "/sprint-plan",
  validate(sprintSchema),
  asyncHandler(controller.sprintPlan),
);
router.post(
  "/standup",
  validate(standupSchema),
  asyncHandler(controller.standup),
);
export default router;
