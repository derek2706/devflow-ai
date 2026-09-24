import { Router } from "express";
import authController from "./auth.controller";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validation";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../shared/errors/asyncHandler";
import { requireAuth } from "../../middlewares/requireAuth";

const router = Router();
router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(authController.register),
);
router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(authController.login),
);
router.post("/refresh", asyncHandler(authController.refresh));
router.post("/logout", asyncHandler(authController.logout));
router.get("/me", requireAuth, asyncHandler(authController.me));
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword),
);
export default router;
