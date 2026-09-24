import { asyncHandler } from "../shared/errors/asyncHandler";
import authService from "../modules/auth/auth.service";

export const requireAuth = asyncHandler(async (req, _res, next) => {
  req.auth = await authService.authenticate(req.cookies?.access_token);
  next();
});
