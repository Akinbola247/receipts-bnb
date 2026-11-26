// Mirrors ReceiptRegistry.verdictFor() exactly — the rule is enforced on-chain.
export type VerdictKey = "LIKELY" | "COIN_FLIP" | "UNLIKELY" | "DELUSIONAL";

export const VERDICTS: Record<
  VerdictKey,
  { label: string; color: string; ink: string; action: string; blurb: string; sizing: string }
> = {
  LIKELY: {
    label: "LIKELY",
    color: "#2bd67b",
    ink: "#0f7a43",
    action: "Market agrees. Position is defensible.",
    blurb: "Prediction markets price this call at 65% or better.",
    sizing: "Normal size. Keep a stop below invalidation.",
  },
  COIN_FLIP: {
    label: "COIN FLIP",
    color: "#f0b90b",
    ink: "#9a6f00",
    action: "It's a coin flip. Don't bet the farm.",
    blurb: "Markets see this as roughly even odds (35–65%).",
    sizing: "Half size at most. Define risk before entry.",
  },
  UNLIKELY: {
    label: "UNLIKELY",
    color: "#ff8a3d",
    ink: "#b34d00",
    action: "Odds are against it. Hedge or size way down.",
    blurb: "Markets give this call between 10% and 35%.",
    sizing: "Small, speculative size only — or hedge existing exposure.",
  },
  DELUSIONAL: {
    label: "DELUSIONAL",
    color: "#ff3b5c",
    ink: "#c4002b",
    action: "Do not follow this call.",
    blurb: "Markets price this under 10%. This is hopium.",
    sizing: "No position. If you already hold, protect the downside.",
  },
};

export const VERDICT_ORDER: VerdictKey[] = ["LIKELY", "COIN_FLIP", "UNLIKELY", "DELUSIONAL"];

export function verdictFor(bps: number): VerdictKey {
  if (bps >= 6500) return "LIKELY";
  if (bps >= 3500) return "COIN_FLIP";
  if (bps >= 1000) return "UNLIKELY";
  return "DELUSIONAL";
}

export function verdictFromIndex(i: number): VerdictKey {
  return VERDICT_ORDER[i] ?? "DELUSIONAL";
}

/** Context modifiers our app adds on top of Cournot (clearly labelled in the UI as ours). */
export function contextNotes(input: {
  fearGreed?: number;
  change24h?: number;
  change7d?: number;
  bps: number;
}): string[] {
  const notes: string[] = [];
  const { fearGreed, change24h, change7d, bps } = input;
  if (fearGreed !== undefined) {
    if (fearGreed <= 25) notes.push(`Fear & Greed at ${fearGreed} (extreme fear): bullish calls tend to be loud and wrong in capitulation phases.`);
    else if (fearGreed >= 75) notes.push(`Fear & Greed at ${fearGreed} (extreme greed): euphoric targets get priced too optimistically.`);
    else notes.push(`Fear & Greed at ${fearGreed}: sentiment is not distorting the picture much.`);
  }
  if (change7d !== undefined && Math.abs(change7d) >= 8) {
    notes.push(`Asset moved ${change7d > 0 ? "+" : ""}${change7d.toFixed(1)}% in 7 days. Momentum is ${change7d > 0 ? "with" : "against"} upside calls.`);
  }
  if (change24h !== undefined && Math.abs(change24h) >= 4) {
    notes.push(`High 24h volatility (${change24h > 0 ? "+" : ""}${change24h.toFixed(1)}%). Widen stops or reduce size.`);
  }
  if (bps < 1000) notes.push("Sub-10% odds: following this call is closer to buying a lottery ticket than trading.");
  return notes;
}
