import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { InterviewChat } from "@/components/interview-chat";
import { MAX_QUESTIONS } from "@/lib/prompts";
import { getInterview } from "@/lib/storage";

export const metadata: Metadata = { title: "Interview · AI Interviewer" };

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const interview = await getInterview(id);

  if (!interview) notFound();
  // Finished interviews live on the results page; refreshing mid-redirect or
  // clicking an old link lands there instead of a dead chat.
  if (interview.status === "completed") redirect(`/results/${id}`);

  // Two things worth noting here:
  // - MAX_QUESTIONS is passed down rather than imported by the client
  //   component, because lib/prompts reaches lib/llm and would drag both
  //   vendor SDKs into the browser bundle.
  // - the key remounts the chat whenever the stored interview has moved on
  //   from what the client is showing, which is how a stale history entry
  //   (back/forward serves a cached render) corrects itself.
  return (
    <InterviewChat
      key={`${interview.transcript.length}-${interview.status}`}
      interview={interview}
      maxQuestions={MAX_QUESTIONS}
    />
  );
}
