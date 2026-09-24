import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { asyncHandler as wrap } from "../../shared/errors/asyncHandler";
import { validateParams as params } from "../../shared/validation";
import controller from "./projects.controller";
import {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  createColumnSchema,
  updateColumnSchema,
} from "./projects.validation";

const router = Router();
router.get(
  "/workspaces/:workspaceId/projects",
  params("workspaceId"),
  wrap(controller.list),
);
router.post(
  "/workspaces/:workspaceId/projects",
  params("workspaceId"),
  validate(createProjectSchema),
  wrap(controller.create),
);
router.get("/projects/:id", params("id"), wrap(controller.get));
router.patch(
  "/projects/:id",
  params("id"),
  validate(updateProjectSchema),
  wrap(controller.update),
);
router.delete("/projects/:id", params("id"), wrap(controller.delete));
router.get("/projects/:id/members", params("id"), wrap(controller.members));
router.post(
  "/projects/:id/members",
  params("id"),
  validate(addProjectMemberSchema),
  wrap(controller.addMember),
);
router.delete(
  "/projects/:id/members/:userId",
  params("id", "userId"),
  wrap(controller.removeMember),
);
router.post(
  "/projects/:projectId/columns",
  params("projectId"),
  validate(createColumnSchema),
  wrap(controller.createColumn),
);
router.patch(
  "/columns/:id",
  params("id"),
  validate(updateColumnSchema),
  wrap(controller.updateColumn),
);
router.delete("/columns/:id", params("id"), wrap(controller.deleteColumn));
export default router;
