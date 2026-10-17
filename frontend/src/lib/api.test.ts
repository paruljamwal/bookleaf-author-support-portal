import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { api } from "./api";

function reply(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  const response = { data, status, statusText: String(status), headers: {}, config };
  if (status >= 200 && status < 300) return response;
  throw new AxiosError("Request failed", AxiosError.ERR_BAD_REQUEST, config, null, response);
}

describe("session refresh", () => {
  const original = api.defaults.adapter;

  afterEach(() => {
    api.defaults.adapter = original;
  });

  it("waits for the CSRF token before posting refresh after a 401", async () => {
    const calls: Array<{ url: string; csrf?: string }> = [];
    api.defaults.adapter = async (config) => {
      const url = config.url ?? "";
      const header = config.headers.get("X-CSRF-Token");
      calls.push({ url, csrf: typeof header === "string" ? header : undefined });
      if (url.includes("/auth/csrf")) return reply(config, 200, { csrfToken: "abc123" });
      if (url.includes("/auth/me") || url.includes("/auth/refresh")) {
        return reply(config, 401, { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
      }
      return reply(config, 500, {});
    };

    await expect(api.get("/auth/me")).rejects.toMatchObject({ response: { status: 401 } });

    const csrfAt = calls.findIndex((call) => call.url.includes("/auth/csrf"));
    const refreshAt = calls.findIndex((call) => call.url.includes("/auth/refresh"));
    expect(csrfAt).toBeGreaterThanOrEqual(0);
    expect(refreshAt).toBeGreaterThan(csrfAt);
    expect(calls[refreshAt]?.csrf).toBe("abc123");
  });
});
