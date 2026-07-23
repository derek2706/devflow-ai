import { z } from "zod";

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name cannot exceed 100 characters"),

    email: z.email().optional(),

    mobileNumber: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Invalid mobile number")
      .optional(),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100),
  })
  .refine((data) => !!data.email || !!data.mobileNumber, {
    message: "Either email or mobile number is required",
    path: ["email"],
  });

export type RegisterRequest = z.infer<typeof registerSchema>;
