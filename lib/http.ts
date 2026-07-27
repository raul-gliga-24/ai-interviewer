// Shared helpers so every API route speaks the same dialect:
// success -> the interview as JSON, failure -> {error: string} with a status.

/** Standard error response. Every non-2xx reply in the app has this shape. */
export function apiError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Read a JSON object body. Returns null for anything that isn't a plain
 * object — malformed JSON, an array, a bare string — so callers can answer
 * with a single 400 instead of throwing.
 */
export async function parseBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Trimmed string, or "" if the value isn't a string. */
export function readTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
