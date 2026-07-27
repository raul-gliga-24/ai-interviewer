import Anthropic from "@anthropic-ai/sdk";
import {
  ChatMessage,
  CompleteOptions,
  LLMError,
  LLMProvider,
} from "./provider";

const MODEL = "claude-sonnet-4-6";

export class ClaudeProvider implements LLMProvider {
  readonly label = "Claude (quality)";
  private client: Anthropic;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    if (!apiKey) throw new LLMError("ANTHROPIC_API_KEY is not set", "claude");
    this.client = new Anthropic({ apiKey });
  }

  async complete(
    messages: ChatMessage[],
    opts: CompleteOptions = {},
  ): Promise<string> {
    // Anthropic's API takes the system prompt as a separate parameter.
    const system = messages.find((m) => m.role === "system")?.content;
    const chat = messages.filter((m) => m.role !== "system");

    try {
      const res = await this.client.messages.create({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.7,
        system,
        messages: chat.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });

      const text = res.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      if (!text) throw new LLMError("Empty response", "claude");
      return text;
    } catch (err) {
      if (err instanceof LLMError) throw err;
      throw new LLMError("Request failed", "claude", err);
    }
  }
}
