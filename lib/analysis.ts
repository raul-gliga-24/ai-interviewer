// Generating the end-of-interview analysis is shared by two callers: the answer
// route (when the interview finishes) and the summary route (when the results
// page asks for it). Both go through ensureAnalysis so the behaviour — and the
// cost — is identical either way.

import { completeJSON } from "./llm";
import { summaryPrompt, type Analysis } from "./prompts";
import { saveInterview, type Interview } from "./storage";

const SENTIMENT_LABELS = ["positive", "neutral", "mixed", "negative"] as const;

// Interviews whose analysis is currently being generated, keyed by id. The
// answer route kicks off a summary and the browser immediately lands on the
// results page, which asks for the same summary — without this the model gets
// called (and billed) twice for one interview.
const inFlight = new Map<string, Promise<Interview>>();

/**
 * Return the interview with its analysis filled in, generating it if needed.
 * Idempotent: an interview that already has an analysis is returned untouched,
 * and concurrent calls for the same id share one model request.
 */
export function ensureAnalysis(interview: Interview): Promise<Interview> {
  if (interview.analysis) return Promise.resolve(interview);

  const pending = inFlight.get(interview.id);
  if (pending) return pending;

  const run = generate(interview).finally(() => inFlight.delete(interview.id));
  inFlight.set(interview.id, run);
  return run;
}

async function generate(interview: Interview): Promise<Interview> {
  const analysis = await completeJSON<unknown>(
    interview.tier,
    summaryPrompt(interview.topic, interview.transcript),
    { maxTokens: 1500 },
  );

  if (!isAnalysis(analysis)) {
    throw new Error("Model returned an analysis with an unexpected shape");
  }

  const updated: Interview = { ...interview, analysis: normalize(analysis) };
  await saveInterview(updated);
  return updated;
}

/**
 * The results page indexes straight into these fields, so a half-formed
 * analysis would crash the UI rather than show a friendly error. Reject it
 * here instead and let the caller retry.
 */
function isAnalysis(value: unknown): value is Analysis {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Record<string, unknown>;

  const sentiment = a.sentiment as Record<string, unknown> | undefined;
  return (
    typeof a.summary === "string" &&
    a.summary.length > 0 &&
    isStringArray(a.themes) &&
    isStringArray(a.keyPoints) &&
    isStringArray(a.keywords) &&
    typeof sentiment === "object" &&
    sentiment !== null &&
    typeof sentiment.score === "number" &&
    Number.isFinite(sentiment.score) &&
    SENTIMENT_LABELS.includes(sentiment.label as (typeof SENTIMENT_LABELS)[number])
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Models occasionally hand back a score just outside the documented range. */
function normalize(analysis: Analysis): Analysis {
  return {
    ...analysis,
    sentiment: {
      ...analysis.sentiment,
      score: Math.max(-1, Math.min(1, analysis.sentiment.score)),
    },
  };
}
