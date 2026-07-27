// The "port": everything outside lib/llm depends only on this interface,
// never on a specific vendor SDK.

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type Tier = "smart" | "fast";

export interface LLMProvider {
  /** Human-readable name, e.g. "Claude Sonnet" — shown in the UI badge */
  readonly label: string;

  /**
   * Send a chat completion request and return the raw text response.
   * Implementations must throw LLMError on failure so callers can
   * handle retries uniformly.
   */
  complete(messages: ChatMessage[], opts?: CompleteOptions): Promise<string>;
}

export type CompleteOptions = {
  maxTokens?: number;
  temperature?: number;
};

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "LLMError";
  }
}
