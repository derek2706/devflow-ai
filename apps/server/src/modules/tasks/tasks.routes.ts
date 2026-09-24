import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { asyncHandler as wrap } from "../../shared/errors/asyncHandler";
import {
  validateParams as params,
  validateQuery,
  paginationSchema,
} from "../../shared/validation";
import controller from "./tasks.controller";
import {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  commentSchema,
} from "./tasks.validation";

const router = Router();
router.get(
  "/projects/:projectId/tasks",
  params("projectId"),
  validateQuery(paginationSchema),
  wrap(controller.list),
);
router.post(
  "/projects/:projectId/tasks",
  params("projectId"),
  validate(createTaskSchema),
  wrap(controller.create),
);
router.get("/tasks/:id", params("id"), wrap(controller.get));
router.patch(
  "/tasks/:id",
  params("id"),
  validate(updateTaskSchema),
  wrap(controller.update),
);
router.patch(
  "/tasks/:id/move",
  params("id"),
  validate(moveTaskSchema),
  wrap(controller.move),
);
router.delete("/tasks/:id", params("id"), wrap(controller.delete));
router.get(
  "/tasks/:id/comments",
  params("id"),
  validateQuery(paginationSchema),
  wrap(controller.comments),
);
router.post(
  "/tasks/:id/comments",
  params("id"),
  validate(commentSchema),
  wrap(controller.addComment),
);
router.delete("/comments/:id", params("id"), wrap(controller.deleteComment));
export default router;
