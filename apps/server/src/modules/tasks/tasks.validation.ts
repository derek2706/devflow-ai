import { z } from "zod";
import {
  descriptionSchema,
  idSchema,
  nonEmptyPatch,
} from "../../shared/validation";

const taskFields = {
  title: z.string().trim().min(1).max(240),
  description: descriptionSchema,
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z.iso.datetime({ offset: true }).nullable(),
  labels: z
    .array(z.string().trim().min(1).max(32))
    .max(20)
    .transform((labels) => [...new Set(labels)]),
  assigneeId: idSchema.nullable(),
};
export const createTaskSchema = z
  .object({
    ...taskFields,
    columnId: idSchema,
    description: taskFields.description.default(""),
    priority: taskFields.priority.default("MEDIUM"),
    dueDate: taskFields.dueDate.default(null),
    labels: taskFields.labels.default([]),
    assigneeId: taskFields.assigneeId.default(null),
  })
  .strict();
export const updateTaskSchema = nonEmptyPatch(taskFields);
export const moveTaskSchema = z
  .object({ columnId: idSchema, position: z.number().int().min(0).max(100000) })
  .strict();
export const commentSchema = z
  .object({ content: z.string().trim().min(1).max(5000) })
  .strict();
export type CreateTask = z.infer<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type MoveTask = z.infer<typeof moveTaskSchema>;
