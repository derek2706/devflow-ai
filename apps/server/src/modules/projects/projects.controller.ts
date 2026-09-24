import { HTTP_STATUS } from "../../shared/constants/http-status";
import { Request, Response } from "express";
import { ApiResponse } from "../../shared/utils/ApiResponse";
import service from "./projects.service";

class ProjectsController {
  async list(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Projects loaded",
        await service.list(req.auth!.userId, String(req.params.workspaceId)),
      ),
    );
  }
  async get(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Project loaded",
        await service.get(req.auth!.userId, String(req.params.id)),
      ),
    );
  }
  async create(req: Request, res: Response) {
    res
      .status(HTTP_STATUS.CREATED)
      .json(
        new ApiResponse(
          HTTP_STATUS.CREATED,
          "Project created",
          await service.create(
            req.auth!.userId,
            String(req.params.workspaceId),
            req.body,
          ),
        ),
      );
  }
  async update(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Project updated",
        await service.update(req.auth!.userId, String(req.params.id), req.body),
      ),
    );
  }
  async delete(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Project deleted",
        await service.delete(req.auth!.userId, String(req.params.id)),
      ),
    );
  }
  async members(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Project members loaded",
        await service.members(req.auth!.userId, String(req.params.id)),
      ),
    );
  }
  async addMember(req: Request, res: Response) {
    res
      .status(HTTP_STATUS.CREATED)
      .json(
        new ApiResponse(
          HTTP_STATUS.CREATED,
          "Project member added",
          await service.addMember(
            req.auth!.userId,
            String(req.params.id),
            req.body.userId,
          ),
        ),
      );
  }
  async removeMember(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Project member removed",
        await service.removeMember(
          req.auth!.userId,
          String(req.params.id),
          String(req.params.userId),
        ),
      ),
    );
  }
  async createColumn(req: Request, res: Response) {
    res
      .status(HTTP_STATUS.CREATED)
      .json(
        new ApiResponse(
          HTTP_STATUS.CREATED,
          "Column created",
          await service.createColumn(
            req.auth!.userId,
            String(req.params.projectId),
            req.body,
          ),
        ),
      );
  }
  async updateColumn(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Column updated",
        await service.updateColumn(
          req.auth!.userId,
          String(req.params.id),
          req.body,
        ),
      ),
    );
  }
  async deleteColumn(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Column deleted",
        await service.deleteColumn(req.auth!.userId, String(req.params.id)),
      ),
    );
  }
}
export default new ProjectsController();
