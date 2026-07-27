import OpenAI from "openai";
import {
  ChatMessage,
  CompleteOptions,
  LLMError,
  LLMProvider,
} from "./provider";

const MODEL = "deepseek-chat";

// DeepSeek exposes an OpenAI-compatible API, so we reuse the openai SDK
// with a custom baseURL instead of pulling in another dependency.
export class DeepSeekProvider implements LLMProvider {
  readonly label = "DeepSeek (fast & cheap)";
  private client: OpenAI;

  constructor(apiKey = process.env.DEEPSEEK_API_KEY) {
    if (!apiKey) throw new LLMError("DEEPSEEK_API_KEY is not set", "deepseek");
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    });
  }

  async complete(
    messages: ChatMessage[],
    opts: CompleteOptions = {},
  ): Promise<string> {
    try {
      const res = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.7,
        messages,
      });

      const text = res.choices[0]?.message?.content;
      if (!text) throw new LLMError("Empty response", "deepseek");
      return text;
    } catch (err) {
      if (err instanceof LLMError) throw err;
      throw new LLMError("Request failed", "deepseek", err);
    }
  }
}
