import { ensureAnalysis } from "@/lib/analysis";
import { apiError, parseBody, readTrimmed, upstreamError } from "@/lib/http";
import { getInterview } from "@/lib/storage";

/** POST /api/interview/summary — body: {id} */
export async function POST(request: Request) {
  const body = await parseBody(request);
  if (!body) return apiError("Request body must be a JSON object.", 400);

  const id = readTrimmed(body.id);
  if (!id) return apiError("An interview id is required.", 400);

  const interview = await getInterview(id);
  if (!interview) return apiError("Interview not found.", 404);

  // Already analysed: hand it back without calling the model again.
  if (interview.analysis) return Response.json(interview);

  if (interview.status !== "completed") {
    return apiError("This interview is still in progress.", 409);
  }

  try {
    return Response.json(await ensureAnalysis(interview));
  } catch (error) {
    return upstreamError(
      error,
      "The analysis could not be generated. Please try again.",
    );
  }
}
