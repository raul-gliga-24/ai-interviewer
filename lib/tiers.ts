// UI-facing description of the two model tiers. Deliberately free of anything
// that imports a vendor SDK, so client components can use it — and deliberately
// worded as tiers rather than model names.

import type { Tier } from "./llm";

export type TierOption = {
  value: Tier;
  label: string;
  hint: string;
};

export const TIERS: TierOption[] = [
  {
    value: "smart",
    label: "Quality",
    hint: "Sharper follow-up questions. Slower, and costs more per interview.",
  },
  {
    value: "fast",
    label: "Fast & cheap",
    hint: "Answers in a second or two for a fraction of the cost.",
  },
];

export function tierLabel(tier: Tier): string {
  return TIERS.find((option) => option.value === tier)?.label ?? tier;
}
