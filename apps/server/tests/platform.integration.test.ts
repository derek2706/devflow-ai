import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { test, mock } from "node:test";
import type { AddressInfo } from "node:net";

test(
  "database-backed workspace, task, planning and session lifecycle",
  { skip: process.env.RUN_INTEGRATION_TESTS !== "1" },
  async (t) => {
    process.env.NODE_ENV = "test";
    process.env.AI_MODE = "local";
    process.env.JWT_ACCESS_SECRET =
      "integration-access-secret-at-least-thirty-two-characters";
    process.env.JWT_REFRESH_SECRET =
      "integration-refresh-secret-at-least-thirty-two-characters";
    const { default: app } = await import("../src/app");
    const { prisma } = await import("../src/lib/prisma");
    const { mailer } = await import("../src/lib/mail");
    const messages: Array<{ to: string; text: string }> = [];
    mock.method(mailer, "send", async (message) => {
      messages.push(message);
    });
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    const suffix = randomUUID();
    const userIds: string[] = [];
    const workspaceIds: string[] = [];
    const password = "Integration@123";

    class Client {
      cookies = new Map<string, string>();
      constructor(readonly email: string) {}
      async request(
        method: string,
        path: string,
        body?: unknown,
        expected = 200,
      ) {
        const response = await fetch(`${base}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        for (const cookie of response.headers.getSetCookie()) {
          const [pair] = cookie.split(";");
          const split = pair.indexOf("=");
          this.cookies.set(pair.slice(0, split), pair.slice(split + 1));
        }
        const result = await response.json();
        assert.equal(
          response.status,
          expected,
          `${method} ${path}: ${JSON.stringify(result)}`,
        );
        return result;
      }
      async register(name: string) {
        const result = await this.request(
          "POST",
          "/auth/register",
          { name, email: this.email, password },
          201,
        );
        userIds.push(result.data.user.id);
        return result.data.user;
      }
    }
    const owner = new Client(`owner-${suffix}@example.test`);
    const member = new Client(`member-${suffix}@example.test`);
    const outsider = new Client(`outsider-${suffix}@example.test`);
    try {
      const ownerUser = await owner.register("Integration owner");
      const memberUser = await member.register("Integration member");
      await outsider.register("Integration outsider");
      const {
        data: { workspace },
      } = await owner.request(
        "POST",
        "/workspaces",
        { name: "Integration workspace" },
        201,
      );
      workspaceIds.push(workspace.id);
      const {
        data: { project },
      } = await owner.request(
        "POST",
        `/workspaces/${workspace.id}/projects`,
        { name: "Delivery board" },
        201,
      );
      const todo = project.columns.find(
        (column: { isDone: boolean }) => !column.isDone,
      );
      const done = project.columns.find(
        (column: { isDone: boolean }) => column.isDone,
      );
      let taskId = "";
      let privateProjectId = "";
      let privateColumnId = "";

      await t.test(
        "permissions and invitations enforce workspace and project boundaries",
        async () => {
          await outsider.request(
            "GET",
            `/projects/${project.id}`,
            undefined,
            404,
          );
          const invitation = await owner.request(
            "POST",
            `/workspaces/${workspace.id}/invitations`,
            { email: member.email, role: "MEMBER" },
            201,
          );
          const token = new URL(
            invitation.data.inviteUrl,
            "http://localhost",
          ).searchParams.get("token");
          await outsider.request("POST", "/invitations/accept", { token }, 403);
          await member.request("POST", "/invitations/accept", { token });
          await member.request("POST", "/invitations/accept", { token }, 400);
          await member.request(
            "GET",
            `/projects/${project.id}`,
            undefined,
            404,
          );
          await owner.request(
            "POST",
            `/projects/${project.id}/members`,
            { userId: memberUser.id },
            201,
          );
          await member.request("GET", `/projects/${project.id}`);
          await member.request(
            "PATCH",
            `/projects/${project.id}`,
            { name: "Forbidden" },
            403,
          );
          await member.request(
            "POST",
            `/workspaces/${workspace.id}/invitations`,
            { email: outsider.email },
            403,
          );
          await owner.request(
            "PATCH",
            `/workspaces/${workspace.id}/members/${ownerUser.id}`,
            { role: "MEMBER" },
            403,
          );
        },
      );

      await t.test(
        "tasks persist details, comments and moves; cross-project columns are rejected",
        async () => {
          const result = await member.request(
            "POST",
            `/projects/${project.id}/tasks`,
            {
              title: "Ship the task flow",
              description: "Verify end-to-end persistence",
              columnId: todo.id,
              priority: "HIGH",
              dueDate: "2026-09-25T12:00:00.000Z",
              labels: ["backend", "release"],
              assigneeId: memberUser.id,
            },
            201,
          );
          taskId = result.data.task.id;
          const comment = await member.request(
            "POST",
            `/tasks/${taskId}/comments`,
            { content: "Ready for review" },
            201,
          );
          const comments = await owner.request(
            "GET",
            `/tasks/${taskId}/comments`,
          );
          assert.equal(comments.data.comments.length, 1);
          const secondProject = await owner.request(
            "POST",
            `/workspaces/${workspace.id}/projects`,
            { name: "Other board" },
            201,
          );
          privateProjectId = secondProject.data.project.id;
          privateColumnId = secondProject.data.project.columns[0].id;
          await member.request(
            "PATCH",
            `/tasks/${taskId}/move`,
            { columnId: secondProject.data.project.columns[0].id, position: 0 },
            400,
          );
          await member.request("PATCH", `/tasks/${taskId}/move`, {
            columnId: done.id,
            position: 0,
          });
          const persisted = await owner.request("GET", `/tasks/${taskId}`);
          assert.equal(persisted.data.task.columnId, done.id);
          assert.deepEqual(persisted.data.task.labels, ["backend", "release"]);
          await member.request(
            "DELETE",
            `/comments/${comment.data.comment.id}`,
          );
          const sibling = await member.request(
            "POST",
            `/projects/${project.id}/tasks`,
            { title: "Keep this timestamp", columnId: todo.id },
            201,
          );
          await member.request("PATCH", `/tasks/${taskId}/move`, {
            columnId: todo.id,
            position: 0,
          });
          const shifted = await member.request(
            "GET",
            `/tasks/${sibling.data.task.id}`,
          );
          assert.equal(
            shifted.data.task.updatedAt,
            sibling.data.task.updatedAt,
          );
          assert.equal(shifted.data.task.position, 1);
          await Promise.all([
            member.request("PATCH", `/tasks/${taskId}/move`, {
              columnId: todo.id,
              position: 1,
            }),
            member.request("PATCH", `/tasks/${sibling.data.task.id}/move`, {
              columnId: todo.id,
              position: 1,
            }),
          ]);
          const board = await member.request("GET", `/projects/${project.id}`);
          const positions = board.data.project.columns
            .find((column: { id: string }) => column.id === todo.id)
            .tasks.map((task: { position: number }) => task.position);
          assert.deepEqual(positions, [0, 1]);
          await member.request("DELETE", `/tasks/${sibling.data.task.id}`);
        },
      );

      await t.test(
        "dashboard and all four planners use permitted persisted data",
        async () => {
          const dashboard = await owner.request(
            "GET",
            `/dashboard?workspaceId=${workspace.id}`,
          );
          assert.ok(dashboard.data.stats.tasks >= 1);
          assert.ok(dashboard.data.recentActivity.length > 0);
          const subtasks = await member.request("POST", "/ai/subtasks", {
            taskId,
          });
          assert.equal(subtasks.data.mode, "local");
          assert.ok(subtasks.data.result.subtasks.length > 0);
          const summary = await member.request("POST", "/ai/project-summary", {
            projectId: project.id,
          });
          assert.match(summary.data.result.summary, /Delivery board/);
          const sprint = await member.request("POST", "/ai/sprint-plan", {
            projectId: project.id,
            capacity: 1,
          });
          assert.equal(sprint.data.result.tasks[0].taskId, taskId);
          const standup = await member.request("POST", "/ai/standup", {
            workspaceId: workspace.id,
          });
          assert.ok(standup.data.result.inProgress.length > 0);
          await outsider.request("POST", "/ai/subtasks", { taskId }, 404);
          await outsider.request(
            "POST",
            "/ai/standup",
            { workspaceId: workspace.id },
            404,
          );
        },
      );

      await t.test(
        "member removal revokes access to projects and task assignment",
        async () => {
          await owner.request(
            "PATCH",
            `/workspaces/${workspace.id}/members/${memberUser.id}`,
            { role: "ADMIN" },
          );
          const adminInvite = await member.request(
            "POST",
            `/workspaces/${workspace.id}/invitations`,
            { email: outsider.email },
            201,
          );
          const adminToken = new URL(
            adminInvite.data.inviteUrl,
            "http://localhost",
          ).searchParams.get("token");
          const assigned = await owner.request(
            "POST",
            `/projects/${privateProjectId}/tasks`,
            {
              title: "Admin assignment",
              columnId: privateColumnId,
              assigneeId: memberUser.id,
            },
            201,
          );
          await owner.request(
            "PATCH",
            `/workspaces/${workspace.id}/members/${memberUser.id}`,
            { role: "MEMBER" },
          );
          await outsider.request(
            "POST",
            "/invitations/accept",
            { token: adminToken },
            400,
          );
          const inaccessible = await owner.request(
            "GET",
            `/tasks/${assigned.data.task.id}`,
          );
          assert.equal(inaccessible.data.task.assigneeId, null);
          const pending = await owner.request(
            "POST",
            `/workspaces/${workspace.id}/invitations`,
            { email: member.email },
            201,
          );
          const pendingToken = new URL(
            pending.data.inviteUrl,
            "http://localhost",
          ).searchParams.get("token");
          await owner.request(
            "DELETE",
            `/workspaces/${workspace.id}/members/${memberUser.id}`,
          );
          await member.request(
            "POST",
            "/invitations/accept",
            { token: pendingToken },
            400,
          );
          await member.request(
            "GET",
            `/projects/${project.id}`,
            undefined,
            404,
          );
          const result = await owner.request("GET", `/tasks/${taskId}`);
          assert.equal(result.data.task.assigneeId, null);
        },
      );

      await t.test(
        "refresh rotation rejects replay and logout invalidates existing access",
        async () => {
          const oldRefresh = owner.cookies.get("refresh_token")!;
          await owner.request("POST", "/auth/refresh");
          assert.notEqual(owner.cookies.get("refresh_token"), oldRefresh);
          const replay = new Client(owner.email);
          replay.cookies.set("refresh_token", oldRefresh);
          await replay.request("POST", "/auth/refresh", undefined, 401);
          await owner.request("GET", "/auth/me", undefined, 401);
          await owner.request("POST", "/auth/login", {
            email: owner.email,
            password,
          });
          const oldAccess = owner.cookies.get("access_token")!;
          await owner.request("POST", "/auth/logout");
          owner.cookies.set("access_token", oldAccess);
          await owner.request("GET", "/auth/me", undefined, 401);
          await owner.request("POST", "/auth/login", {
            email: owner.email,
            password,
          });
        },
      );

      await t.test(
        "password reset is generic, single use and revokes prior sessions",
        async () => {
          const known = await owner.request("POST", "/auth/forgot-password", {
            email: owner.email,
          });
          const unknown = await owner.request("POST", "/auth/forgot-password", {
            email: `missing-${suffix}@example.test`,
          });
          assert.deepEqual(known, unknown);
          const message = messages.find((item) => item.to === owner.email)!;
          assert.ok(message);
          const link = message.text.match(/https?:\/\/\S+/)![0];
          const token = new URL(link).searchParams.get("token");
          await owner.request("POST", "/auth/reset-password", {
            token,
            password: "NewIntegration@123",
          });
          await owner.request(
            "POST",
            "/auth/reset-password",
            { token, password: "AnotherIntegration@123" },
            400,
          );
          await owner.request("GET", "/auth/me", undefined, 401);
          await owner.request(
            "POST",
            "/auth/login",
            { email: owner.email, password },
            401,
          );
          await owner.request("POST", "/auth/login", {
            email: owner.email,
            password: "NewIntegration@123",
          });
          await owner.request("DELETE", `/workspaces/${workspace.id}`);
          await owner.request("GET", `/projects/${project.id}`, undefined, 404);
        },
      );
    } finally {
      mock.restoreAll();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
      await prisma.workspace.deleteMany({
        where: { id: { in: workspaceIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    }
  },
);
