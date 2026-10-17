import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { api, loadCsrf, resolveApiBase } from "./api";

function reply(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  const response = { data, status, statusText: String(status), headers: {}, config };
  if (status >= 200 && status < 300) return response;
  throw new AxiosError("Request failed", AxiosError.ERR_BAD_REQUEST, config, null, response);
}

describe("api base", () => {
  it("keeps a cross-origin API on the page origin so the session cookie can be stored", () => {
    expect(
      resolveApiBase(
        "https://bookleaf-author-support-portal.netlify.app",
        "https://bookleaf-author-support-portal-api.onrender.com/api/v1",
      ),
    ).toBe("/api/v1");
    expect(resolveApiBase("http://localhost:5173", "")).toBe("/api/v1");
    expect(resolveApiBase("http://localhost:5173", "http://localhost:5173/api/v1")).toBe(
      "http://localhost:5173/api/v1",
    );
  });
});

describe("csrf header", () => {
  const original = api.defaults.adapter;

  afterEach(() => {
    api.defaults.adapter = original;
  });

  it("attaches the issued CSRF token and credentials on registration", async () => {
    const issued = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.1893456000.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    api.defaults.adapter = async (config) => {
      const url = config.url ?? "";
      if (url.includes("/auth/csrf")) return reply(config, 200, { csrfToken: issued });
      if (url.includes("/auth/register")) {
        expect(config.withCredentials).toBe(true);
        expect(config.headers.get("X-CSRF-Token")).toBe(issued);
        return reply(config, 201, { user: { role: "AUTHOR" } });
      }
      return reply(config, 500, {});
    };

    await loadCsrf();
    const response = await api.post("/auth/register", {
      name: "Ada",
      email: "ada@email.com",
      password: "Register#Pass1",
    });
    expect(response.status).toBe(201);
    expect(api.defaults.withCredentials).toBe(true);
  });
});

describe("session refresh", () => {
  const original = api.defaults.adapter;

  afterEach(() => {
    api.defaults.adapter = original;
  });

  it("does not refresh a signed-out session check", async () => {
    const calls: string[] = [];
    api.defaults.adapter = async (config) => {
      const url = config.url ?? "";
      calls.push(url);
      if (url.includes("/auth/me")) {
        return reply(config, 401, { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
      }
      return reply(config, 500, {});
    };

    await expect(api.get("/auth/me")).rejects.toMatchObject({
      response: { status: 401, data: { error: { code: "UNAUTHENTICATED" } } },
    });
    expect(calls.some((url) => url.includes("/auth/refresh"))).toBe(false);
  });

  it("refreshes once after the access cookie expires and does not retry a CSRF failure", async () => {
    const calls: Array<{ url: string; csrf?: string }> = [];
    api.defaults.adapter = async (config) => {
      const url = config.url ?? "";
      const header = config.headers.get("X-CSRF-Token");
      calls.push({ url, csrf: typeof header === "string" ? header : undefined });
      if (url.includes("/auth/csrf")) return reply(config, 200, { csrfToken: "abc123" });
      if (url.includes("/auth/refresh")) {
        return reply(config, 403, { error: { code: "CSRF_REJECTED", message: "Refresh the page and try again." } });
      }
      if (url.includes("/auth/me")) {
        return reply(config, 401, { error: { code: "ACCESS_EXPIRED", message: "Sign in to continue." } });
      }
      return reply(config, 500, {});
    };

    await expect(api.get("/auth/me")).rejects.toMatchObject({
      response: { status: 401, data: { error: { code: "ACCESS_EXPIRED" } } },
    });

    const refreshCalls = calls.filter((call) => call.url.includes("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
    expect(refreshCalls[0]?.csrf).toBe("abc123");
    const csrfAt = calls.findIndex((call) => call.url.includes("/auth/csrf"));
    const refreshAt = calls.findIndex((call) => call.url.includes("/auth/refresh"));
    expect(refreshAt).toBeGreaterThan(csrfAt);
  });
});
