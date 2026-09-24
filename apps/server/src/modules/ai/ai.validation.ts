import { z } from "zod";

export const subtasksSchema = z.object({ taskId: z.uuid() });
export const summarySchema = z.object({ projectId: z.uuid() });
export const sprintSchema = summarySchema.extend({
  goal: z.string().trim().max(500).optional(),
  capacity: z.number().int().min(1).max(30).default(10),
});
export const standupSchema = z.object({
  workspaceId: z.uuid(),
  date: z.iso.date().optional(),
});

export const subtasksResult = z.object({
  subtasks: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(5000),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
      }),
    )
    .min(1)
    .max(10),
});
export const summaryResult = z.object({
  summary: z.string().max(5000),
  highlights: z.array(z.string().max(1000)).max(15),
  risks: z.array(z.string().max(1000)).max(15),
});
export const sprintResult = z.object({
  goal: z.string().max(1000),
  tasks: z
    .array(
      z.object({
        taskId: z.string(),
        title: z.string().max(200),
        reason: z.string().max(1000),
      }),
    )
    .max(30),
  notes: z.array(z.string().max(1000)).max(15),
});
export const standupResult = z.object({
  completed: z.array(z.string().max(1000)).max(30),
  inProgress: z.array(z.string().max(1000)).max(30),
  blockers: z.array(z.string().max(1000)).max(30),
});
