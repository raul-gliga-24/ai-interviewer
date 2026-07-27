import { apiError } from "@/lib/http";
import { listInterviews } from "@/lib/storage";

// Reads the data directory on every request — never prerender it.
export const dynamic = "force-dynamic";

/** GET /api/interviews — newest first, for the history list on the home page. */
export async function GET() {
  try {
    return Response.json(await listInterviews());
  } catch {
    return apiError("Could not read stored interviews.", 500);
  }
}
