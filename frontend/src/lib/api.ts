import axios from "axios";
import type { ApiErrorBody } from "@bookleaf/shared";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
});

/** Token from GET /auth/csrf. A cross-origin API cookie is not visible to document.cookie. */
let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

export function loadCsrf(): Promise<string> {
  csrfRequest ??= api
    .get<{ csrfToken?: unknown }>("/auth/csrf")
    .then((response) => {
      const token = response.data?.csrfToken;
      if (typeof token !== "string" || token.length === 0) {
        throw new Error("CSRF token missing");
      }
      csrfToken = token;
      return token;
    })
    .finally(() => {
      csrfRequest = null;
    });
  return csrfRequest;
}

function readCookie(name: string): string | null {
  const row = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.slice(name.length + 1)) : null;
}

api.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toLowerCase();
  if (!["get", "head", "options"].includes(method)) {
    const token = csrfToken ?? readCookie("bookleaf_csrf");
    if (token) config.headers["X-CSRF-Token"] = token;
  }
  return config;
});

api.interceptors.response.use((response) => {
  const url = response.config.url ?? "";
  const token = (response.data as { csrfToken?: unknown } | undefined)?.csrfToken;
  if (url.includes("/auth/csrf") && typeof token === "string" && token.length > 0) {
    csrfToken = token;
  }
  return response;
});

let refreshRequest: Promise<void> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) throw error;
    const config = error.config as typeof error.config & { _retry?: boolean };
    const url = config.url ?? "";
    const skipRefresh = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/csrf"].some((path) =>
      url.includes(path),
    );
    if (error.response?.status !== 401 || config._retry || skipRefresh) throw error;
    config._retry = true;
    refreshRequest ??= loadCsrf()
      .then(() => api.post("/auth/refresh"))
      .then(() => undefined)
      .finally(() => {
        refreshRequest = null;
      });
    try {
      await refreshRequest;
    } catch (refreshError) {
      if (
        axios.isAxiosError(refreshError) &&
        (refreshError.response?.status === 401 || refreshError.response?.status === 403)
      ) {
        throw error;
      }
      throw refreshError;
    }
    return api(config);
  },
);

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.error?.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}
