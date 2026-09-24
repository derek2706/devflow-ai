import { CookieOptions, Request, Response } from "express";
import authService from "./auth.service";
import { HTTP_STATUS } from "../../shared/constants/http-status";
import { ApiResponse } from "../../shared/utils/ApiResponse";
import { getEnv } from "../../config/env";
import { AUTH_MESSAGES } from "./auth.constants";
import { SessionResult } from "./auth.types";

function cookieOptions(path: string): CookieOptions {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production" || env.API_COOKIE_SECURE === "true",
    path,
  };
}
function setSession(res: Response, result: SessionResult) {
  res.cookie("access_token", result.accessToken, {
    ...cookieOptions("/"),
    maxAge: result.accessMaxAge,
  });
  res.cookie("refresh_token", result.refreshToken, {
    ...cookieOptions("/api/auth"),
    maxAge: result.refreshMaxAge,
  });
}
function clearSession(res: Response) {
  res.clearCookie("access_token", cookieOptions("/"));
  res.clearCookie("refresh_token", cookieOptions("/api/auth"));
}
class AuthController {
  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    setSession(res, result);
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, AUTH_MESSAGES.LOGIN_SUCCESS, {
        user: result.user,
      }),
    );
  }
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    setSession(res, result);
    return res.status(HTTP_STATUS.CREATED).json(
      new ApiResponse(HTTP_STATUS.CREATED, AUTH_MESSAGES.USER_REGISTERED, {
        user: result.user,
      }),
    );
  }
  async refresh(req: Request, res: Response) {
    try {
      const result = await authService.refresh(req.cookies?.refresh_token);
      setSession(res, result);
      return res.json(
        new ApiResponse(HTTP_STATUS.OK, "Session refreshed", {
          user: result.user,
        }),
      );
    } catch (error) {
      clearSession(res);
      throw error;
    }
  }
  async logout(req: Request, res: Response) {
    await authService.logout(
      req.cookies?.refresh_token,
      req.cookies?.access_token,
    );
    clearSession(res);
    return res.json(
      new ApiResponse(HTTP_STATUS.OK, AUTH_MESSAGES.LOGOUT_SUCCESS),
    );
  }
  async me(req: Request, res: Response) {
    return res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Current user",
        await authService.me(req.auth!.userId),
      ),
    );
  }
  async forgotPassword(req: Request, res: Response) {
    await authService.forgotPassword(req.body.email);
    return res.json(
      new ApiResponse(HTTP_STATUS.OK, AUTH_MESSAGES.FORGOT_PASSWORD),
    );
  }
  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword(req.body.token, req.body.password);
    clearSession(res);
    return res.json(
      new ApiResponse(HTTP_STATUS.OK, AUTH_MESSAGES.PASSWORD_RESET),
    );
  }
}
export default new AuthController();
