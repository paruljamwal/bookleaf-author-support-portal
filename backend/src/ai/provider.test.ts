import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "../config/env.js";
import { OpenAiCompatibleProvider } from "./openai-provider.js";

const ENV_KEYS = [
  "NODE_ENV",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "AI_API_KEY",
  "AI_BASE_URL",
  "AI_MODEL",
  "AI_TIMEOUT_MS",
] as const;

const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function configureEnv(overrides: Record<string, string> = {}): void {
  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = "test-access-secret-which-is-long-enough";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-which-is-long-enough";
  process.env.AI_API_KEY = "sk-test";
  process.env.AI_BASE_URL = "https://example.invalid/v1";
  process.env.AI_MODEL = "gpt-4o-mini";
  process.env.AI_TIMEOUT_MS = "5000";
  Object.assign(process.env, overrides);
  resetEnvCache();
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const request = {
  operation: "classify" as const,
  messages: [{ role: "user" as const, content: "Classify this ticket." }],
  maxTokens: 180,
  temperature: 0.1,
};

describe("openai-compatible provider", () => {
  beforeEach(() => {
    configureEnv();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetEnvCache();
  });

  it("retries a rate limit once and keeps the token counts", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls += 1;
      if (calls === 1) return new Response("", { status: 429 });
      return jsonResponse(200, {
        model: "gpt-4o-mini",
        choices: [{ message: { content: '{"category":"GENERAL_INQUIRY"}' } }],
        usage: { prompt_tokens: 40, completion_tokens: 12 },
      });
    });
    const result = await new OpenAiCompatibleProvider().complete(request);
    expect(calls).toBe(2);
    expect(result.promptTokens).toBe(40);
    expect(result.completionTokens).toBe(12);
    expect(result.content).toContain("GENERAL_INQUIRY");
  });

  it("retries a server error once and does not retry an authentication error", async () => {
    let serverCalls = 0;
    vi.stubGlobal("fetch", async () => {
      serverCalls += 1;
      if (serverCalls === 1) return new Response("", { status: 503 });
      return jsonResponse(200, {
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });
    });
    await new OpenAiCompatibleProvider().complete(request);
    expect(serverCalls).toBe(2);

    let authCalls = 0;
    vi.stubGlobal("fetch", async () => {
      authCalls += 1;
      return new Response("unauthorized", { status: 401 });
    });
    await expect(new OpenAiCompatibleProvider().complete(request)).rejects.toMatchObject({
      code: "UPSTREAM",
      retryable: false,
    });
    expect(authCalls).toBe(1);
  });

  it("retries JSON mode once without the response format", async () => {
    const bodies: string[] = [];
    let calls = 0;
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      calls += 1;
      bodies.push(String(init?.body ?? ""));
      if (calls === 1) {
        return jsonResponse(400, {
          error: { message: "response_format json_object is not supported" },
        });
      }
      return jsonResponse(200, {
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 3, completion_tokens: 2 },
      });
    });
    await new OpenAiCompatibleProvider().complete(request);
    expect(calls).toBe(2);
    expect(bodies[0]).toContain("json_object");
    expect(bodies[1]).not.toContain("response_format");
  });

  it("times out once and does not retry", async () => {
    configureEnv({ AI_TIMEOUT_MS: "30" });
    let calls = 0;
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });
    await expect(new OpenAiCompatibleProvider().complete(request)).rejects.toMatchObject({
      name: "AiProviderError",
      code: "TIMEOUT",
      retryable: false,
    });
    expect(calls).toBe(1);
  });
});
