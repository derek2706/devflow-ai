import { z } from "zod";
import { idSchema } from "../../shared/validation";

export const dashboardQuerySchema = z
  .object({ workspaceId: idSchema.optional() })
  .strict();
