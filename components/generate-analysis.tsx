"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { AnalysisView } from "@/components/analysis-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Analysis } from "@/lib/prompts";

/**
 * Landing on the results page without an analysis means the summary was never
 * written — normally because the model call failed on the closing turn. The
 * endpoint is idempotent, so asking for it again is always safe.
 */
export function GenerateAnalysis({ id }: { id: string }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/interview/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          // 503 means the tier cannot work as configured — retrying is futile.
          setRetryable(res.status !== 503);
          throw new Error(data.error ?? "Could not write the summary.");
        }
        setAnalysis(data.analysis);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not write the summary.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (analysis) return <AnalysisView analysis={analysis} />;

  if (error) {
    return (
      <div
        role="alert"
        className="border-destructive/50 bg-destructive/5 space-y-3 rounded-lg border p-4"
      >
        <p className="text-sm font-medium">The summary could not be written.</p>
        <p className="text-muted-foreground text-sm">
          Your answers are safe — only the summary is missing, and the transcript below
          is complete.
        </p>
        <p className="text-sm">{error}</p>
        {retryable && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            <RotateCcw />
            Try again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-busy="true">
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Reading back your answers…
      </p>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-9/12" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
