import { HTTP_STATUS } from "../../shared/constants/http-status";
import { Request, Response } from "express";
import { ApiResponse } from "../../shared/utils/ApiResponse";
import service from "./tasks.service";

class TasksController {
  async list(req: Request, res: Response) {
    const { limit, offset } = res.locals.validatedQuery;
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Tasks loaded",
        await service.list(
          req.auth!.userId,
          String(req.params.projectId),
          limit,
          offset,
        ),
      ),
    );
  }
  async get(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Task loaded",
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
          "Task created",
          await service.create(
            req.auth!.userId,
            String(req.params.projectId),
            req.body,
          ),
        ),
      );
  }
  async update(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Task updated",
        await service.update(req.auth!.userId, String(req.params.id), req.body),
      ),
    );
  }
  async move(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Task moved",
        await service.move(req.auth!.userId, String(req.params.id), req.body),
      ),
    );
  }
  async delete(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Task deleted",
        await service.delete(req.auth!.userId, String(req.params.id)),
      ),
    );
  }
  async comments(req: Request, res: Response) {
    const { limit, offset } = res.locals.validatedQuery;
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Comments loaded",
        await service.comments(
          req.auth!.userId,
          String(req.params.id),
          limit,
          offset,
        ),
      ),
    );
  }
  async addComment(req: Request, res: Response) {
    res
      .status(HTTP_STATUS.CREATED)
      .json(
        new ApiResponse(
          HTTP_STATUS.CREATED,
          "Comment added",
          await service.addComment(
            req.auth!.userId,
            String(req.params.id),
            req.body.content,
          ),
        ),
      );
  }
  async deleteComment(req: Request, res: Response) {
    res.json(
      new ApiResponse(
        HTTP_STATUS.OK,
        "Comment deleted",
        await service.deleteComment(req.auth!.userId, String(req.params.id)),
      ),
    );
  }
}
export default new TasksController();
