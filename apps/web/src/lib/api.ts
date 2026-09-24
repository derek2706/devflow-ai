const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let refreshing: Promise<boolean> | null = null;

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Couldn't connect to DevFlow. Check that the API server is running and try again.",
      0,
    );
  }
  if (
    response.status === 401 &&
    retry &&
    ![
      "/auth/login",
      "/auth/register",
      "/auth/refresh",
      "/auth/logout",
    ].includes(path)
  ) {
    refreshing ??= fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
    if (await refreshing) return api<T>(path, options, false);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      body.message ||
        body.errors?.[0]?.message ||
        `Request failed (${response.status}). Please try again.`,
      response.status,
    );
  return body.data as T;
}
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const remove = (path: string) =>
  api<unknown>(path, { method: "DELETE" });
export const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
export function listOf<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && key in data)
    return (data as Record<string, T[]>)[key] || [];
  return [];
}
export function itemOf<T>(data: unknown, key: string): T {
  return (
    data && typeof data === "object" && key in data
      ? (data as Record<string, unknown>)[key]
      : data
  ) as T;
}
