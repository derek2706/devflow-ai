import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { asyncHandler as wrap } from "../../shared/errors/asyncHandler";
import { validateParams as params } from "../../shared/validation";
import controller from "./workspaces.controller";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  memberRoleSchema,
  invitationSchema,
  acceptInvitationSchema,
} from "./workspaces.validation";

const router = Router();
router.get("/workspaces", wrap(controller.list));
router.post(
  "/workspaces",
  validate(createWorkspaceSchema),
  wrap(controller.create),
);
router.get("/workspaces/:id", params("id"), wrap(controller.get));
router.patch(
  "/workspaces/:id",
  params("id"),
  validate(updateWorkspaceSchema),
  wrap(controller.update),
);
router.delete("/workspaces/:id", params("id"), wrap(controller.delete));
router.get("/workspaces/:id/members", params("id"), wrap(controller.members));
router.patch(
  "/workspaces/:id/members/:userId",
  params("id", "userId"),
  validate(memberRoleSchema),
  wrap(controller.updateMember),
);
router.delete(
  "/workspaces/:id/members/:userId",
  params("id", "userId"),
  wrap(controller.removeMember),
);
router.post(
  "/workspaces/:id/invitations",
  params("id"),
  validate(invitationSchema),
  wrap(controller.invite),
);
router.post(
  "/invitations/accept",
  validate(acceptInvitationSchema),
  wrap(controller.accept),
);
export default router;
