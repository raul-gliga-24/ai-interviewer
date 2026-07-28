import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Analysis } from "@/lib/prompts";

const SENTIMENT: Record<Analysis["sentiment"]["label"], { fill: string; text: string }> = {
  positive: { fill: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  mixed: { fill: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  neutral: { fill: "bg-slate-400", text: "text-slate-600 dark:text-slate-400" },
  negative: { fill: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
};

export function AnalysisView({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Summary</h2>
        <p className="leading-relaxed">{analysis.summary}</p>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Sentiment</h2>
        <SentimentBar sentiment={analysis.sentiment} />
      </section>

      <Separator />

      <List title="Themes" items={analysis.themes} />

      <Separator />

      <List title="Key points" items={analysis.keyPoints} />

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Keywords</h2>
        <div className="flex flex-wrap gap-2">
          {analysis.keywords.map((keyword) => (
            <Badge key={keyword} variant="secondary" className="font-normal">
              {keyword}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">{title}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="bg-muted-foreground/40 mt-2 size-1.5 shrink-0 rounded-full" />
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The score runs from -1 to 1, so the bar fills outwards from the middle: left
 * of centre for negative, right for positive, and the width is how strongly.
 */
function SentimentBar({ sentiment }: { sentiment: Analysis["sentiment"] }) {
  const score = Math.max(-1, Math.min(1, sentiment.score));
  const left = score < 0 ? 50 + score * 50 : 50;
  const width = Math.abs(score) * 50;
  const style = SENTIMENT[sentiment.label];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className={`font-medium capitalize ${style.text}`}>{sentiment.label}</span>
        <span className="text-muted-foreground text-sm tabular-nums">
          {score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2)}
        </span>
      </div>

      <div
        role="img"
        aria-label={`Sentiment ${sentiment.label}, scored ${score.toFixed(2)} on a scale from -1 to 1`}
        className="bg-muted relative h-2.5 w-full rounded-full"
      >
        <div className="bg-border absolute inset-y-0 left-1/2 w-px" />
        <div
          className={`absolute inset-y-0 rounded-full ${style.fill}`}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>

      <div className="text-muted-foreground flex justify-between text-xs">
        <span>Negative</span>
        <span>Neutral</span>
        <span>Positive</span>
      </div>
    </div>
  );
}
