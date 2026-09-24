import { HTTP_STATUS } from "./constants/http-status";
import { z } from "zod";
import { Request, Response, NextFunction } from "express";

export const idSchema = z.string().uuid();
export const nameSchema = z.string().trim().min(1).max(120);
export const descriptionSchema = z.string().trim().max(10000);
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export const nonEmptyPatch = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .strict()
    .partial()
    .refine(
      (data) => Object.keys(data).length > 0,
      "Provide at least one field",
    );

export function validateParams(...names: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const name of names) {
      if (!idSchema.safeParse(req.params[name]).success)
        return res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json({ success: false, message: `Invalid ${name}` });
    }
    next();
  };
}

export function validateQuery(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success)
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Invalid query parameters",
        errors: result.error.issues,
      });
    res.locals.validatedQuery = result.data;
    next();
  };
}
