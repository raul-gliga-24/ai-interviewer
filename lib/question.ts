// Reading the interviewer's reply, and deciding when the interview is over.
// Kept apart from the routes because it is the one piece of real logic in the
// flow — and the one worth testing on its own.

import { MAX_QUESTIONS, MIN_QUESTIONS } from "./prompts";

/**
 * What nextQuestionPrompt asks the model to return. `unexplored` only comes
 * back on the turns where ending early is allowed: it is the quote the model
 * found to justify continuing, or null when it found nothing. It is reasoning,
 * not content — it is never stored on the interview.
 */
export type NextQuestion = {
  question: string | null;
  done: boolean;
  unexplored?: string | null;
};

/** The next question, or "" if the model didn't give us a usable one. */
export function readQuestion(next: unknown): string {
  return readField(next, "question");
}

/** The quote the model found, or "" when it reported none. */
export function readUnexplored(next: unknown): string {
  return readField(next, "unexplored");
}

function readField(next: unknown, key: "question" | "unexplored"): string {
  if (typeof next !== "object" || next === null) return "";
  const value = (next as Record<string, unknown>)[key];
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  // Some models write the word instead of the literal.
  return trimmed.toLowerCase() === "null" ? "" : trimmed;
}

/**
 * Whether the cap alone decides the outcome. Worth asking before calling the
 * model: at the cap the interview ends no matter what comes back, so there is
 * nothing for the answer to change.
 */
export function atQuestionCap(asked: number): boolean {
  return asked >= MAX_QUESTIONS;
}

/**
 * Whether the interview should end now, given how many questions have already
 * been asked and answered.
 *
 * The bounds are ours, not the model's: MAX_QUESTIONS always wins, and below
 * MIN_QUESTIONS an early finish is impossible. Between the two we go by what
 * the model found rather than by its `done` flag — no quote naming something
 * left unexplained, or no question to ask about it, means there is nothing
 * left to ask.
 */
export function shouldFinish(asked: number, next: unknown): boolean {
  if (asked >= MAX_QUESTIONS) return true;
  if (asked < MIN_QUESTIONS) return false;
  return readUnexplored(next) === "" || readQuestion(next) === "";
}
