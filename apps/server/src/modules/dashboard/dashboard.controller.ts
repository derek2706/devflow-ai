import { HTTP_STATUS } from "../../shared/constants/http-status";
import { Request, Response } from "express";
import { ApiResponse } from "../../shared/utils/ApiResponse";
import service from "./dashboard.service";

class DashboardController {
  async get(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Dashboard loaded",
        await service.get(
          req.auth!.userId,
          res.locals.validatedQuery.workspaceId,
        ),
      ),
    );
  }
}
export default new DashboardController();
