import { z } from "zod";
import {
  nameSchema,
  descriptionSchema,
  nonEmptyPatch,
} from "../../shared/validation";

const workspaceFields = {
  name: nameSchema,
  description: descriptionSchema.default(""),
};
export const createWorkspaceSchema = z.object(workspaceFields).strict();
export const updateWorkspaceSchema = nonEmptyPatch({
  name: nameSchema,
  description: descriptionSchema,
});
export const memberRoleSchema = z
  .object({ role: z.enum(["ADMIN", "MEMBER"]) })
  .strict();
export const invitationSchema = z
  .object({
    email: z.email().trim().toLowerCase().max(254),
    role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
  })
  .strict();
export const acceptInvitationSchema = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export type CreateWorkspace = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspace = z.infer<typeof updateWorkspaceSchema>;
export type InviteMember = z.infer<typeof invitationSchema>;
