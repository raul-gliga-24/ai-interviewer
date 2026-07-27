import { ClaudeProvider } from "./claude";
import { DeepSeekProvider } from "./deepseek";
import { ChatMessage, CompleteOptions, LLMProvider, Tier } from "./provider";

export * from "./provider";

// Providers are constructed lazily so a missing API key for one vendor
// doesn't break the other.
const cache = new Map<Tier, LLMProvider>();

export function getProvider(tier: Tier): LLMProvider {
  if (!cache.has(tier)) {
    cache.set(
      tier,
      tier === "smart" ? new ClaudeProvider() : new DeepSeekProvider(),
    );
  }
  return cache.get(tier)!;
}

/**
 * Ask the model for JSON and parse it, retrying once on malformed output.
 * Cheap models occasionally wrap JSON in markdown fences or add preamble —
 * we strip fences first, and if parsing still fails we retry with a
 * corrective message appended.
 */
export async function completeJSON<T>(
  tier: Tier,
  messages: ChatMessage[],
  opts?: CompleteOptions,
): Promise<T> {
  const provider = getProvider(tier);

  const tryParse = (raw: string): T | null => {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // Last resort: extract the first {...} block from surrounding prose.
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as T;
        } catch {
          return null;
        }
      }
      return null;
    }
  };

  const first = await provider.complete(messages, opts);
  const parsed = tryParse(first);
  if (parsed !== null) return parsed;

  // Retry once, telling the model exactly what went wrong.
  const retry = await provider.complete(
    [
      ...messages,
      { role: "assistant", content: first },
      {
        role: "user",
        content:
          "Your previous response was not valid JSON. Respond again with ONLY the JSON object, no markdown fences, no explanation.",
      },
    ],
    opts,
  );
  const reparsed = tryParse(retry);
  if (reparsed !== null) return reparsed;

  throw new Error(`Model returned invalid JSON twice (${provider.label})`);
}
