import { restoreSession } from "../../auth/api";

export class MonitoringApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export class MonitoringApi {
  private async csrfToken(signal?: AbortSignal) {
    // Re-bootstrap for each write so logout/login or another tab's cookie
    // rotation cannot leave this module holding an obsolete CSRF token.
    const response = await fetch("/auth/csrf", {
      credentials: "include",
      signal,
    });
    if (!response.ok)
      throw new MonitoringApiError(
        response.status,
        "Unable to initialize secure request",
      );
    return ((await response.json()) as { csrfToken: string }).csrfToken;
  }
  async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
    retry = true,
  ): Promise<T> {
    const write = !["GET", "HEAD"].includes(method);
    const response = await fetch(`/api/${path.replace(/^\//, "")}`, {
      method,
      credentials: "include",
      signal,
      headers: write
        ? {
            "Content-Type": "application/json",
            "X-CSRF-Token": await this.csrfToken(signal),
          }
        : {},
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 401 && retry && !signal?.aborted) {
      const profile = await restoreSession();
      if (profile) return this.request<T>(path, method, body, signal, false);
    }
    const data: unknown = await response.json();
    if (!response.ok) {
      const error = data as { message?: unknown };
      throw new MonitoringApiError(
        response.status,
        typeof error.message === "string"
          ? error.message
          : "Monitoring request failed",
      );
    }
    return data as T;
  }
}
export const monitoringApi = new MonitoringApi();
export const monitoringRoot = (projectId: string) =>
  `projects/${encodeURIComponent(projectId)}/monitoring`;
