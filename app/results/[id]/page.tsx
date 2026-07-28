import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnalysisView } from "@/components/analysis-view";
import { GenerateAnalysis } from "@/components/generate-analysis";
import { Transcript } from "@/components/transcript";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getInterview } from "@/lib/storage";
import { tierLabel } from "@/lib/tiers";

export const metadata: Metadata = { title: "Results · AI Interviewer" };

// Reads the interview from disk on every request; the analysis can arrive
// after the page was first rendered.
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const interview = await getInterview(id);
  if (!interview) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 p-6 py-12">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{interview.topic}</h1>
          <Badge variant="outline" className="shrink-0">
            {tierLabel(interview.tier)}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {DATE.format(new Date(interview.createdAt))} · {interview.transcript.length}{" "}
          {interview.transcript.length === 1 ? "question" : "questions"} answered
        </p>
      </header>

      {interview.analysis ? (
        <AnalysisView analysis={interview.analysis} />
      ) : (
        <GenerateAnalysis id={interview.id} />
      )}

      <Separator />

      <Transcript transcript={interview.transcript} />

      <div className="flex justify-center pt-2">
        <Button asChild size="lg">
          <Link href="/">Start a new interview</Link>
        </Button>
      </div>
    </main>
  );
}
