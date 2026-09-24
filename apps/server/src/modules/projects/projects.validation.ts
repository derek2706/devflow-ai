import { z } from "zod";
import {
  nameSchema,
  descriptionSchema,
  idSchema,
  nonEmptyPatch,
} from "../../shared/validation";

const projectFields = {
  name: nameSchema,
  description: descriptionSchema,
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/, "Use a six-digit hex color"),
};
export const createProjectSchema = z
  .object({
    name: nameSchema,
    description: descriptionSchema.default(""),
    color: projectFields.color.default("#6366f1"),
  })
  .strict();
export const updateProjectSchema = nonEmptyPatch(projectFields);
export const addProjectMemberSchema = z.object({ userId: idSchema }).strict();
export const createColumnSchema = z
  .object({ name: nameSchema, isDone: z.boolean().default(false) })
  .strict();
export const updateColumnSchema = nonEmptyPatch({
  name: nameSchema,
  position: z.number().int().min(0).max(100),
  isDone: z.boolean(),
});
export type CreateProject = z.infer<typeof createProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type CreateColumn = z.infer<typeof createColumnSchema>;
export type UpdateColumn = z.infer<typeof updateColumnSchema>;
