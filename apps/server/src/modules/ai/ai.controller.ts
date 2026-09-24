import type { Request, Response } from "express";
import { ApiResponse } from "../../shared/utils/ApiResponse";
import { HTTP_STATUS } from "../../shared/constants/http-status";
import { getEnv } from "../../config/env";
import service from "./ai.service";

class AiController {
  status(_req: Request, res: Response) {
    res.json(
      new ApiResponse(HTTP_STATUS.OK, "Planner configuration", {
        mode: getEnv().AI_MODE,
      }),
    );
  }
  async subtasks(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Subtask suggestions generated",
        await service.subtasks(req.auth!.userId, req.body.taskId),
      ),
    );
  }
  async projectSummary(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Project summary generated",
        await service.projectSummary(req.auth!.userId, req.body.projectId),
      ),
    );
  }
  async sprintPlan(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Sprint plan generated",
        await service.sprintPlan(req.auth!.userId, req.body),
      ),
    );
  }
  async standup(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Standup generated",
        await service.standup(req.auth!.userId, req.body),
      ),
    );
  }
}
export default new AiController();
