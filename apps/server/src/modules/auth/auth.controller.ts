import { Request, Response } from "express";

import authService from "./auth.service";
import { HTTP_STATUS } from "@/shared/constants/http-status";
import { ApiResponse } from "@/shared/utils/ApiResponse";
import { AUTH_MESSAGES } from "./auth.constants";

class AuthController {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);

    return res
      .status(HTTP_STATUS.CREATED)
      .json(
        new ApiResponse(
          HTTP_STATUS.CREATED,
          AUTH_MESSAGES.USER_ALREADY_EXISTS,
          result,
        ),
      );
  }
}

export default new AuthController();
