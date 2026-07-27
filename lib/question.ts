// Reading the interviewer's {question, done} reply, and deciding when the
// interview is over. Kept apart from the routes because it is the one piece of
// real logic in the flow — and the one worth testing on its own.

import { MAX_QUESTIONS, MIN_QUESTIONS } from "./prompts";

/** What nextQuestionPrompt asks the model to return. */
export type NextQuestion = { question: string | null; done: boolean };

/** The next question, or "" if the model didn't give us a usable one. */
export function readQuestion(next: unknown): string {
  if (typeof next !== "object" || next === null) return "";
  const question = (next as { question?: unknown }).question;
  return typeof question === "string" ? question.trim() : "";
}

/**
 * Whether the interview should end now, given how many questions have already
 * been asked and answered.
 *
 * The bounds are ours, not the model's: MAX_QUESTIONS always wins, and below
 * MIN_QUESTIONS an early `done` is ignored. Past the floor we take the model's
 * judgement — and treat a missing question as "nothing left to ask" rather
 * than as an error, since the interview is long enough to stand on its own.
 */
export function shouldFinish(asked: number, next: unknown): boolean {
  if (asked >= MAX_QUESTIONS) return true;
  if (asked < MIN_QUESTIONS) return false;

  const done =
    typeof next === "object" &&
    next !== null &&
    (next as { done?: unknown }).done === true;

  return done || readQuestion(next) === "";
}
