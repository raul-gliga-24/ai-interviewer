import { ensureAnalysis } from "@/lib/analysis";
import { apiError, parseBody, readTrimmed, upstreamError } from "@/lib/http";
import { completeJSON } from "@/lib/llm";
import { nextQuestionPrompt } from "@/lib/prompts";
import {
  atQuestionCap,
  readQuestion,
  shouldFinish,
  type NextQuestion,
} from "@/lib/question";
import { getInterview, saveInterview, type Interview } from "@/lib/storage";

const ANSWER_MAX = 4000;

/** POST /api/interview/answer — body: {id, answer} */
export async function POST(request: Request) {
  const body = await parseBody(request);
  if (!body) return apiError("Request body must be a JSON object.", 400);

  const id = readTrimmed(body.id);
  if (!id) return apiError("An interview id is required.", 400);

  const answer = readTrimmed(body.answer);
  if (!answer) return apiError("An answer is required.", 400);
  if (answer.length > ANSWER_MAX) {
    return apiError(`Answers are limited to ${ANSWER_MAX} characters.`, 400);
  }

  const interview = await getInterview(id);
  if (!interview) return apiError("Interview not found.", 404);
  if (interview.status === "completed") {
    return apiError("This interview is already completed.", 409);
  }

  const pending = interview.transcript.at(-1);
  if (!pending) {
    return apiError("There is no question waiting for an answer.", 409);
  }

  if (pending.answer === null) {
    // Save the answer before calling the model. If the next call fails the
    // user never has to retype anything, and the interview is resumable.
    pending.answer = answer;
    pending.answeredAt = new Date().toISOString();
    await saveInterview(interview);
  }
  // Otherwise the answer is already recorded and the model call is what failed
  // last time. Keep the stored answer and just retry the question generation,
  // which makes retrying the same request safe.

  // At the cap the interview is over whatever the model says, so asking it
  // would cost a call and a second and a half on the slowest request in the
  // app — the one that also has to write the analysis.
  if (atQuestionCap(interview.transcript.length)) {
    return Response.json(await complete(interview));
  }

  let next: NextQuestion;
  try {
    next = await completeJSON<NextQuestion>(
      interview.tier,
      nextQuestionPrompt(interview.topic, interview.transcript),
      { maxTokens: 300 },
    );
  } catch (error) {
    return upstreamError(
      error,
      "The interviewer could not be reached. Your answer was saved — please retry.",
    );
  }

  if (!shouldFinish(interview.transcript.length, next)) {
    const question = readQuestion(next);
    if (!question) {
      return apiError(
        "The interviewer did not return a question. Your answer was saved — please retry.",
        502,
      );
    }
    interview.transcript.push({
      question,
      answer: null,
      askedAt: new Date().toISOString(),
      answeredAt: null,
    });
    await saveInterview(interview);
    return Response.json(interview);
  }

  return Response.json(await complete(interview));
}

/**
 * Close the interview out. The completed state is saved before the analysis is
 * attempted, so a failing summary can never leave an interview stuck
 * in_progress with no question to answer — the results page picks it up from
 * /api/interview/summary instead.
 */
async function complete(interview: Interview): Promise<Interview> {
  interview.status = "completed";
  interview.completedAt = new Date().toISOString();
  await saveInterview(interview);

  try {
    return await ensureAnalysis(interview);
  } catch {
    return interview;
  }
}
