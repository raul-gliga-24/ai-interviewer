// Telling apart the two ways a model call fails, because they need opposite
// advice: "try again" is right for a blip and useless for a missing key or an
// empty account, where retrying can only fail the same way.

import { LLMError } from "./llm";
import type { Tier } from "./llm";

/** Statuses that mean the request will never succeed as configured. */
const PERMANENT_STATUSES = new Set([401, 402, 403]);

export function isTierUnavailable(error: unknown): boolean {
  if (!(error instanceof LLMError)) return false;

  // Thrown by the adapters when the key is missing entirely.
  if (error.message.includes("is not set")) return true;

  const cause = error.cause as { status?: unknown } | undefined;
  return typeof cause?.status === "number" && PERMANENT_STATUSES.has(cause.status);
}

/** Which tiers have credentials configured. Server-side only. */
export function configuredTiers(): Record<Tier, boolean> {
  return {
    smart: Boolean(process.env.ANTHROPIC_API_KEY),
    fast: Boolean(process.env.DEEPSEEK_API_KEY),
  };
}
