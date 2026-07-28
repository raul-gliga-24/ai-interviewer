import { InterviewHistory } from "@/components/interview-history";
import { StartInterviewForm } from "@/components/start-interview-form";
import { listInterviews } from "@/lib/storage";
import { configuredTiers } from "@/lib/upstream";

// The history list reads the data directory, so this page is always fresh.
export const dynamic = "force-dynamic";

export default async function Home() {
  const interviews = await listInterviews();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-10 p-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">AI Interviewer</h1>
        <p className="text-muted-foreground">
          Pick a topic and answer a few questions. Each one is written from what you
          said before, and you get a summary of your answers at the end.
        </p>
      </header>

      <StartInterviewForm available={configuredTiers()} />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Past interviews</h2>
        <InterviewHistory interviews={interviews} />
      </section>
    </main>
  );
}
