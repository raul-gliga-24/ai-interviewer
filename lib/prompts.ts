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

/**
 * Generate the next question (or signal the interview is done).
 * Expected response: { "question": string | null, "done": boolean }
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
    ? `The maximum has been reached. End the interview.`
    : asked >= MIN_QUESTIONS
      ? `You may either ask one more question (if the answers so far leave something genuinely worth exploring) or end the interview.`
      : `Ask the next question.`
}

Respond with ONLY this JSON:
{"question": "<the next question, or null if ending>", "done": <true if the interview is over, else false>}`,
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

Base everything only on what the interviewee actually said. The sentiment reflects the interviewee's attitude toward the topic, not the tone of the questions.`,
    },
  ];
}
