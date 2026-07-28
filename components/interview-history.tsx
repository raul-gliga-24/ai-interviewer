import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { tierLabel } from "@/lib/tiers";
import type { Interview } from "@/lib/storage";

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function InterviewHistory({ interviews }: { interviews: Interview[] }) {
  if (interviews.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        No interviews yet. Pick a topic above and your transcript will show up here.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {interviews.map((interview) => {
        const done = interview.status === "completed";
        return (
          <li key={interview.id}>
            <Link
              href={done ? `/results/${interview.id}` : `/interview/${interview.id}`}
              className="hover:bg-accent flex items-center gap-4 p-4 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{interview.topic}</p>
                <p className="text-muted-foreground text-sm">
                  {DATE.format(new Date(interview.createdAt))} ·{" "}
                  {interview.transcript.length}{" "}
                  {interview.transcript.length === 1 ? "question" : "questions"}
                </p>
              </div>
              <Badge variant="outline">{tierLabel(interview.tier)}</Badge>
              <Badge variant={done ? "secondary" : "default"}>
                {done ? "Completed" : "In progress"}
              </Badge>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
