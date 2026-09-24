import { HTTP_STATUS } from "../../shared/constants/http-status";
import { Request, Response } from "express";
import { ApiResponse } from "../../shared/utils/ApiResponse";
import service from "./workspaces.service";

class WorkspacesController {
  async list(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Workspaces loaded",
        await service.list(req.auth!.userId),
      ),
    );
  }
  async get(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Workspace loaded",
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
          "Workspace created",
          await service.create(req.auth!.userId, req.body),
        ),
      );
  }
  async update(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Workspace updated",
        await service.update(req.auth!.userId, String(req.params.id), req.body),
      ),
    );
  }
  async delete(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Workspace deleted",
        await service.delete(req.auth!.userId, String(req.params.id)),
      ),
    );
  }
  async members(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Members loaded",
        await service.members(req.auth!.userId, String(req.params.id)),
      ),
    );
  }
  async updateMember(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Member updated",
        await service.updateMember(
          req.auth!.userId,
          String(req.params.id),
          String(req.params.userId),
          req.body.role,
        ),
      ),
    );
  }
  async removeMember(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Member removed",
        await service.removeMember(
          req.auth!.userId,
          String(req.params.id),
          String(req.params.userId),
        ),
      ),
    );
  }
  async invite(req: Request, res: Response) {
    res
      .status(HTTP_STATUS.CREATED)
      .json(
        new ApiResponse(
          HTTP_STATUS.CREATED,
          "Invitation created",
          await service.invite(
            req.auth!.userId,
            String(req.params.id),
            req.body,
          ),
        ),
      );
  }
  async accept(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Invitation accepted",
        await service.accept(req.auth!.userId, req.body.token),
      ),
    );
  }
}
export default new WorkspacesController();
