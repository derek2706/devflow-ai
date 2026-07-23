import { Router } from "express";

import authController from "./auth.controller";
import { registerSchema } from "./auth.validation";

import { validate } from "@/middlewares/validate";
import { asyncHandler } from "@/shared/errors/asyncHandler";

const router = Router();

router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(authController.register),
);

export default router;
