// Every prompt lives here so prompt design is reviewable in one file.

import { ChatMessage } from "./llm";
import { QA } from "./storage";

export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 5;

const INTERVIEWER_SYSTEM = `You are a professional interviewer conducting a short, focused interview.

Rules:
- Ask exactly ONE question at a time.
- Questions must be short (max 25 words), open-ended, and neutral — never leading.
- Build each question on the interviewee's previous answers when possible; dig into interesting details they mention.
- Stay strictly on the interview topic.
- Never answer the questions yourself, give opinions, or add commentary.
- If an answer is short, vague, or evasive, move on to a different aspect of the topic. Never remark on how the interviewee is answering or ask why they are not engaging.
- The interview lasts between ${MIN_QUESTIONS} and ${MAX_QUESTIONS} questions total.

You always respond with ONLY a JSON object, no markdown fences, no extra text.`;

/** Transcript rendered as plain text for inclusion in prompts. */
function renderTranscript(topic: string, transcript: QA[]): string {
  if (transcript.length === 0) return `Topic: "${topic}"\n(no questions asked yet)`;
  const lines = transcript.map(
    (qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer ?? "(not answered yet)"}`,
  );
  return `Topic: "${topic}"\n\n${lines.join("\n\n")}`;
}

const QUESTION_JSON = `Respond with ONLY this JSON:
{"question": "<the next question, or null if ending>", "done": <true if the interview is over, else false>}`;

/**
 * Past MIN_QUESTIONS the interview can end early, and asking the model to
 * simply judge that doesn't work — whichever branch is phrased as the default
 * is the one it always takes. So it reports evidence first and the decision
 * falls out of whether it can name any: a verbatim quote means there is
 * something left to ask, no quote means there isn't.
 */
const CONTINUE_OR_STOP = `Decide whether to ask one more question, by evidence rather than preference.

First, look for evidence: something the interviewee said above that is specific and that they left unexplained. Quote it word for word. If nothing they said is specific enough to follow up on, the quote is null. Both outcomes are equally acceptable — neither is the answer you are supposed to reach.

Then let the evidence decide: with a quote, ask one final question about that exact thing. Without one, the interview is over.

Respond with ONLY this JSON:
{"unexplored": "<the exact quote, or null>", "question": "<your follow-up about that quote, or null>", "done": <true if unexplored is null, false if it is not>}`;

/**
 * Generate the next question (or signal the interview is done).
 * Expected response: { "question": string | null, "done": boolean }, plus
 * "unexplored" on the turns where ending early is allowed.
 */
export function nextQuestionPrompt(topic: string, transcript: QA[]): ChatMessage[] {
  const asked = transcript.length;
  return [
    { role: "system", content: INTERVIEWER_SYSTEM },
    {
      role: "user",
      content: `${renderTranscript(topic, transcript)}

Questions asked so far: ${asked} of max ${MAX_QUESTIONS}.

${
  asked >= MAX_QUESTIONS
    ? `The maximum has been reached. End the interview.\n\n${QUESTION_JSON}`
    : asked >= MIN_QUESTIONS
      ? CONTINUE_OR_STOP
      : `Ask the next question.\n\n${QUESTION_JSON}`
}`,
    },
  ];
}

export type Analysis = {
  summary: string;
  themes: string[];
  sentiment: { label: "positive" | "neutral" | "mixed" | "negative"; score: number };
  keyPoints: string[];
  keywords: string[];
};

/**
 * Summarize + analyze the finished interview.
 * Expected response: Analysis (see type above)
 */
export function summaryPrompt(topic: string, transcript: QA[]): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are an analyst producing a structured report of an interview. You respond with ONLY a JSON object, no markdown fences, no extra text.",
    },
    {
      role: "user",
      content: `${renderTranscript(topic, transcript)}

Analyze the interviewee's responses and respond with ONLY this JSON:
{
  "summary": "<3-5 sentence neutral summary of what the interviewee said>",
  "themes": ["<2-4 recurring themes>"],
  "sentiment": {"label": "<positive|neutral|mixed|negative>", "score": <number from -1 to 1>},
  "keyPoints": ["<3-5 of the most important specific points made>"],
  "keywords": ["<5-8 keywords or short phrases, extracted from the answers>"]
}

Base everything only on what the interviewee actually said. The sentiment reflects the interviewee's attitude toward the topic, not the tone of the questions. Keywords must be topical terms, not filler quoted from the answers.`,
    },
  ];
}
