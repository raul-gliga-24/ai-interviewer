"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { QA } from "@/lib/storage";

export function Transcript({ transcript }: { transcript: QA[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors">
        <span className="font-medium">
          Full transcript · {transcript.length}{" "}
          {transcript.length === 1 ? "question" : "questions"}
        </span>
        <ChevronDown
          className={`text-muted-foreground size-4 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-6 px-1 pt-6">
        {transcript.map((qa, index) => (
          <div key={index} className="space-y-2">
            <p className="text-muted-foreground text-sm font-medium">
              Question {index + 1}
            </p>
            <p className="font-medium">{qa.question}</p>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {qa.answer ?? "Not answered."}
            </p>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
