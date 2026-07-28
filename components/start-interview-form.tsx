"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TIERS } from "@/lib/tiers";
import type { Tier } from "@/lib/llm";

const PRESETS = [
  "AI in the workplace",
  "Productivity tools",
  "Remote work",
  "Learning to code",
  "Team communication",
  "Open source",
];

export function StartInterviewForm({
  available,
}: {
  available: Record<Tier, boolean>;
}) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [tier, setTier] = useState<Tier>(available.fast ? "fast" : "smart");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = topic.trim();
  const anyAvailable = TIERS.some((option) => available[option.value]);
  const unavailable = TIERS.filter((option) => !available[option.value]);
  const canStart = trimmed.length >= 3 && !starting && available[tier];
  const activeTier = TIERS.find((option) => option.value === tier);

  async function start() {
    if (!canStart) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed, tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the interview.");
      router.push(`/interview/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the interview.");
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label htmlFor="topic" className="text-sm font-medium">
          What should the interview be about?
        </label>
        <Input
          id="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void start();
            }
          }}
          placeholder="e.g. AI in the workplace"
          maxLength={120}
          disabled={starting}
          autoFocus
        />
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant={trimmed === preset ? "secondary" : "outline"}
              size="sm"
              disabled={starting}
              onClick={() => setTopic(preset)}
            >
              {preset}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Interviewer</span>
        <ToggleGroup
          type="single"
          value={tier}
          onValueChange={(value) => {
            if (value) setTier(value as Tier);
          }}
          variant="outline"
          disabled={starting}
          className="justify-start"
        >
          {TIERS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              className="px-4"
              disabled={!available[option.value]}
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-muted-foreground text-sm">{activeTier?.hint}</p>
        {anyAvailable
          ? unavailable.length > 0 && (
              <p className="text-muted-foreground text-sm">
                {unavailable.map((option) => option.label).join(" and ")}{" "}
                {unavailable.length === 1 ? "is" : "are"} unavailable — no API key
                configured.
              </p>
            )
          : (
              <p role="alert" className="text-destructive text-sm">
                Neither interviewer is configured. Add an API key to .env.local and
                restart the server.
              </p>
            )}
      </div>

      <div className="space-y-3">
        <Button onClick={start} disabled={!canStart} size="lg">
          {starting ? (
            <>
              <Loader2 className="animate-spin" />
              Writing the first question…
            </>
          ) : (
            "Start interview"
          )}
        </Button>
        {starting && (
          <p className="text-muted-foreground text-sm">
            This takes a few seconds while the interviewer reads your topic.
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
