import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tierLabel } from "@/lib/tiers";
import { getInterview } from "@/lib/storage";

export const metadata: Metadata = { title: "Results · AI Interviewer" };

// Placeholder so the interview flow has somewhere to land. Milestone 3 builds
// the real thing: summary, themes, sentiment bar, key points, keyword chips and
// the collapsible transcript.
export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const interview = await getInterview(id);
  if (!interview) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{interview.topic}</h1>
        <Badge variant="outline">{tierLabel(interview.tier)}</Badge>
      </div>

      <p className="text-muted-foreground">
        {interview.transcript.length} questions answered.
        {interview.analysis
          ? " The summary is ready."
          : " The summary has not been generated yet."}
      </p>

      <Button asChild>
        <Link href="/">Start a new interview</Link>
      </Button>
    </main>
  );
}
