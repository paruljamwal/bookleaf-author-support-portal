import { getEnv } from "../config/env.js";
import {
  AiProviderError,
  type AiCompletionRequest,
  type AiCompletionResult,
  type AiProvider,
} from "./provider.js";

interface ChatResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai-compatible";

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    try {
      return await this.send(request, true);
    } catch (error) {
      if (error instanceof AiProviderError && error.retryWithoutJson) {
        return this.send(request, false);
      }
      if (error instanceof AiProviderError && error.retryable) {
        return this.send(request, true);
      }
      throw error;
    }
  }

  private async send(request: AiCompletionRequest, jsonMode: boolean): Promise<AiCompletionResult> {
    const env = getEnv();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
    try {
      const response = await fetch(`${env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.AI_MODEL,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          messages: request.messages,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (response.status === 429) {
        throw new AiProviderError("RATE_LIMIT", "The language model rate-limited the request.", {
          retryable: true,
        });
      }
      if (!response.ok) {
        let retryWithoutJson = false;
        if (response.status === 400) {
          const body = (await response.text()).slice(0, 500);
          retryWithoutJson = /response_format|json_object/i.test(body);
        }
        throw new AiProviderError(
          "UPSTREAM",
          `The language model returned status ${response.status}.`,
          {
            retryable: response.status >= 500,
            retryWithoutJson,
          },
        );
      }
      const payload = (await response.json()) as ChatResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (!content)
        throw new AiProviderError(
          "INVALID_OUTPUT",
          "The language model returned an empty response.",
        );
      return {
        content,
        model: payload.model ?? env.AI_MODEL,
        promptTokens: payload.usage?.prompt_tokens ?? null,
        completionTokens: payload.usage?.completion_tokens ?? null,
      };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AiProviderError("TIMEOUT", "The language model timed out.");
      }
      throw new AiProviderError("UPSTREAM", "The language model request failed.");
    } finally {
      clearTimeout(timer);
    }
  }
}
