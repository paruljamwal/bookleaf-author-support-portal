export interface AiMessage {
  role: "system" | "user";
  content: string;
}

export interface AiCompletionRequest {
  operation: "classify" | "draft";
  messages: AiMessage[];
  maxTokens: number;
  temperature: number;
}

export interface AiCompletionResult {
  content: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface AiProvider {
  readonly name: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}

export class AiProviderError extends Error {
  readonly code: "TIMEOUT" | "RATE_LIMIT" | "INVALID_OUTPUT" | "UPSTREAM";
  readonly retryable: boolean;
  readonly retryWithoutJson: boolean;

  constructor(
    code: AiProviderError["code"],
    message: string,
    options: { retryable?: boolean; retryWithoutJson?: boolean } = {},
  ) {
    super(message);
    this.name = "AiProviderError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.retryWithoutJson = options.retryWithoutJson ?? false;
  }
}
