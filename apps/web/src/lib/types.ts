export type User = {
  id: string;
  name: string;
  avatar?: string | null;
  email?: string;
};
export type Role = "OWNER" | "ADMIN" | "MEMBER";
export type Member = { userId: string; user: User; role: Role };
export type Workspace = {
  id: string;
  name: string;
  description?: string | null;
  role?: Role;
  memberCount?: number;
  projectCount?: number;
  members?: Member[];
  _count?: { projects?: number; members?: number };
};
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Task = {
  id: string;
  title: string;
  description?: string | null;
  projectId: string;
  columnId: string;
  priority: Priority;
  dueDate?: string | null;
  labels: string[];
  position: number;
  assigneeId?: string | null;
  assignee?: User | null;
  column?: { id: string; name: string };
  project?: { id: string; name: string; color: string };
  createdAt?: string;
  updatedAt?: string;
  _count?: { comments?: number };
};
export type Column = {
  id: string;
  name: string;
  position: number;
  isDone: boolean;
  tasks: Task[];
};
export type Project = {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  workspaceId: string;
  createdById?: string;
  columns: Column[];
  members: Member[];
  workspace?: Workspace;
  _count?: { tasks?: number; members?: number };
  createdAt?: string;
};
export type Comment = {
  id: string;
  content: string;
  authorId: string;
  author: User;
  createdAt: string;
};
export type Activity = {
  id: string;
  action: string;
  description?: string;
  createdAt: string;
  user?: User;
  actor?: User;
  project?: { id: string; name: string };
  entityType?: string;
  entityName?: string;
};
export type DashboardData = {
  stats: Record<string, number>;
  workspaces: Workspace[];
  projects: Project[];
  recentTasks: Task[];
  recentActivity: Activity[];
};
export type AiStatus = {
  mode: "local" | "provider";
  provider?: "groq";
  model?: string;
};
export type AiResult = AiStatus & {
  fallbackReason?: "quota" | "unavailable" | "timeout" | "invalid_response";
  contextLimited?: boolean;
  result: {
    subtasks?: { title: string; description: string; priority: Priority }[];
    summary?: string;
    highlights?: string[];
    risks?: string[];
    goal?: string;
    tasks?: { taskId: string; title: string; reason: string }[];
    notes?: string[];
    completed?: string[];
    inProgress?: string[];
    blockers?: string[];
  };
};
