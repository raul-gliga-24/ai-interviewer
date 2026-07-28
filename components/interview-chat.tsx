"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { tierLabel } from "@/lib/tiers";
import type { Interview } from "@/lib/storage";

/**
 * A normal turn takes a second or two; the turn that ends the interview also
 * writes the summary and takes several. We can't know in advance which one we
 * are on unless the cap has been reached, so a slow turn is taken to be the
 * closing one — but only once ending is possible at all. Below MIN_QUESTIONS
 * the interview cannot end, so a slow turn there is just a slow turn, and the
 * threshold itself is only calibrated against one provider.
 */
const CLOSING_TURN_AFTER_MS = 2500;

/** Drafts survive a remount (see the key on this component) but not a reload. */
const drafts = new Map<string, string>();

type Phase = "idle" | "sending" | "closing" | "failed";

export function InterviewChat({
  interview: initial,
  minQuestions,
  maxQuestions,
}: {
  interview: Interview;
  minQuestions: number;
  maxQuestions: number;
}) {
  const router = useRouter();
  const [interview, setInterview] = useState(initial);
  const [draft, setDraft] = useState(() => drafts.get(initial.id) ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [sentAnswer, setSentAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);

  const busy = phase === "sending" || phase === "closing";
  const asked = interview.transcript.length;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [asked, phase, sentAnswer]);

  // Coming back to this page through history replays a cached render of it,
  // which can be older than what's on disk. Ask the server for the current
  // state on arrival; the page remounts this component when the answer differs
  // from what we were given, so there is no prop to sync by hand.
  useEffect(() => {
    router.refresh();
  }, [router]);

  async function send(answer: string) {
    const value = answer.trim();
    if (!value) return;

    setSentAnswer(value);
    setDraft("");
    drafts.delete(interview.id);
    setError(null);
    setRetryable(true);

    // At the cap this turn is definitely the last one. Before MIN_QUESTIONS it
    // definitely isn't, so the clock is never consulted there. In between, a
    // turn that outlives a normal one is treated as the closing turn.
    const lastForCertain = asked >= maxQuestions;
    const couldBeLast = asked >= minQuestions;
    setPhase(lastForCertain ? "closing" : "sending");
    const timer =
      lastForCertain || !couldBeLast
        ? undefined
        : setTimeout(() => setPhase("closing"), CLOSING_TURN_AFTER_MS);

    try {
      const res = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: interview.id, answer: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 503 means this tier cannot work as configured, so a retry button
        // would only invite the same failure.
        setRetryable(res.status !== 503);
        throw new Error(data.error ?? "Something went wrong.");
      }

      setInterview(data);
      setSentAnswer(null);

      if (data.status === "completed") {
        router.push(`/results/${data.id}`);
        return;
      }
      setPhase("idle");
    } catch (err) {
      // The answer stays on screen and in state so nothing is retyped, and the
      // retry sends exactly the same text — the API treats that as a resume.
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("failed");
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <header className="space-y-3 pb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">{interview.topic}</h1>
          <Badge variant="outline">{tierLabel(interview.tier)}</Badge>
        </div>
        <div className="space-y-1.5">
          <Progress value={(asked / maxQuestions) * 100} />
          <p className="text-muted-foreground text-sm">
            Question {asked} of up to {maxQuestions} — it may end sooner.
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-4">
        {interview.transcript.map((qa, index) => (
          <div key={index} className="space-y-4">
            <Bubble side="left">{qa.question}</Bubble>
            {qa.answer !== null && <Bubble side="right">{qa.answer}</Bubble>}
          </div>
        ))}

        {sentAnswer && (
          <Bubble side="right" muted={phase === "failed"}>
            {sentAnswer}
          </Bubble>
        )}

        {busy && <Thinking closing={phase === "closing"} />}

        {phase === "failed" && (
          <div
            role="alert"
            className="border-destructive/50 bg-destructive/5 space-y-3 rounded-lg border p-4"
          >
            <p className="text-sm">{error}</p>
            {retryable ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => sentAnswer && void send(sentAnswer)}
              >
                <RotateCcw />
                Try again
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">
                Your answers are saved. This interview can be resumed once the
                interviewer is configured.
              </p>
            )}
          </div>
        )}

        <div ref={bottom} />
      </div>

      <div className="bg-background sticky bottom-0 space-y-2 pt-6 pb-4">
        <Textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            drafts.set(interview.id, event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
          placeholder="Type your answer…"
          rows={3}
          maxLength={4000}
          disabled={busy || phase === "failed"}
          autoFocus
        />
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            Enter to send · Shift + Enter for a new line
          </p>
          <Button
            onClick={() => void send(draft)}
            disabled={busy || phase === "failed" || draft.trim().length === 0}
          >
            Send
          </Button>
        </div>
      </div>
    </main>
  );
}

function Bubble({
  side,
  muted = false,
  children,
}: {
  side: "left" | "right";
  muted?: boolean;
  children: React.ReactNode;
}) {
  const right = side === "right";
  return (
    <div className={right ? "flex justify-end" : "flex justify-start"}>
      <p
        className={[
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
          right ? "bg-primary text-primary-foreground" : "bg-muted",
          muted ? "opacity-50" : "",
        ].join(" ")}
      >
        {children}
      </p>
    </div>
  );
}

function Thinking({ closing }: { closing: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-muted flex gap-1 rounded-2xl px-4 py-3">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      {closing && (
        <span className="text-muted-foreground text-sm">
          Wrapping up your interview…
        </span>
      )}
    </div>
  );
}
