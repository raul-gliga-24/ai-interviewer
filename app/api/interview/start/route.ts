import { apiError, parseBody, readTrimmed, upstreamError } from "@/lib/http";
import { completeJSON } from "@/lib/llm";
import { nextQuestionPrompt } from "@/lib/prompts";
import { createInterview, saveInterview } from "@/lib/storage";
import type { NextQuestion } from "@/lib/question";
import { readQuestion } from "@/lib/question";

const TOPIC_MIN = 3;
const TOPIC_MAX = 120;

/** POST /api/interview/start — body: {topic, tier} */
export async function POST(request: Request) {
  const body = await parseBody(request);
  if (!body) return apiError("Request body must be a JSON object.", 400);

  const topic = readTrimmed(body.topic);
  if (topic.length < TOPIC_MIN || topic.length > TOPIC_MAX) {
    return apiError(
      `Topic must be between ${TOPIC_MIN} and ${TOPIC_MAX} characters.`,
      400,
    );
  }

  const tier = body.tier;
  if (tier !== "smart" && tier !== "fast") {
    return apiError('Tier must be either "smart" or "fast".', 400);
  }

  // Ask for the first question before creating the interview: if the model is
  // unreachable we don't want an empty interview left behind in the history.
  let first: NextQuestion;
  try {
    first = await completeJSON<NextQuestion>(
      tier,
      nextQuestionPrompt(topic, []),
      { maxTokens: 300 },
    );
  } catch (error) {
    return upstreamError(
      error,
      "The interviewer could not be reached. Please try again.",
    );
  }

  const question = readQuestion(first);
  if (!question) {
    return apiError("The interviewer did not return a question.", 502);
  }

  const interview = await createInterview(topic, tier);
  interview.transcript.push({
    question,
    answer: null,
    askedAt: new Date().toISOString(),
    answeredAt: null,
  });
  await saveInterview(interview);

  return Response.json(interview, { status: 201 });
}
