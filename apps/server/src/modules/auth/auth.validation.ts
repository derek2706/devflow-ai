import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email());
const mobileNumber = z.string().regex(/^[6-9]\d{9}$/, "Invalid mobile number");
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password cannot exceed 72 bytes",
  );
const identifiers = {
  email: email.optional(),
  mobileNumber: mobileNumber.optional(),
};
const exactlyOneIdentifier = (data: {
  email?: string;
  mobileNumber?: string;
}) => Boolean(data.email) !== Boolean(data.mobileNumber);

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    ...identifiers,
    password,
  })
  .refine(exactlyOneIdentifier, {
    message: "Provide exactly one of email or mobile number",
    path: ["email"],
  });

export const loginSchema = z
  .object({
    ...identifiers,
    password: z
      .string()
      .min(1, "Password is required")
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        "Password cannot exceed 72 bytes",
      ),
  })
  .refine(exactlyOneIdentifier, {
    message: "Provide exactly one of email or mobile number",
    path: ["email"],
  });

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password,
});
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
