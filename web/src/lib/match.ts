// Claim ↔ market matching. Shared by the browser (to pick a market) and the server (to enforce it).
//
// A prediction market prices ONE specific event ("STRK above $0.30 before 2027"). A call is often a
// different event ("STRK to $5 by December"). Using the wrong market's odds would be a lie, so:
//   exact  — same asset, same direction, threshold within 2%  → the market's p IS the call's p
//   bound  — same asset & direction, market threshold is EASIER than the call's target
//            (above: lower threshold; below: higher threshold) → P(call) ≤ P(market): an upper bound
//   loose  — the call has no parsable $ target: best semantic match, flagged as such
//   none   — nothing defensible → no receipt

import type { CournotMarket } from "./cournot";
import { assetNames, detectAsset } from "./assets";

export type MatchMode = "exact" | "bound" | "loose";
export type Parsed = { asset: string; target: number | null; direction: "above" | "below" };
export type MatchResult =
  | { ok: true; mode: MatchMode; market: CournotMarket; claim: Parsed; marketTarget: number | null }
  | { ok: false; reason: string; claim: Parsed; closest: CournotMarket[] };

function parseMoney(text: string): number | null {
  const m = text.toLowerCase().replace(/,/g, "").match(/\$\s?(\d+(?:\.\d+)?)\s*(k|m|b|thousand|million)?\b/);
  if (!m) {
    const k = text.toLowerCase().replace(/,/g, "").match(/\b(\d+(?:\.\d+)?)\s*(k|m)\b/);
    if (!k) return null;
    return Number(k[1]) * (k[2] === "k" ? 1e3 : 1e6);
  }
  let n = Number(m[1]);
  const u = m[2];
  if (u === "k" || u === "thousand") n *= 1e3;
  if (u === "m" || u === "million") n *= 1e6;
  if (u === "b") n *= 1e9;
  return n;
}

function parseDirection(text: string): "above" | "below" {
  return /\b(below|under|drop|drops|dump|dumps|fall|falls|crash|crashes|sink|sinks|dip|dips|lose|loses|less than|bottom)\b/i.test(text)
    ? "below"
    : "above";
}

export function parseClaim(claim: string): Parsed {
  return { asset: detectAsset(claim), target: parseMoney(claim), direction: parseDirection(claim) };
}

export function parseMarket(title: string): { target: number | null; direction: "above" | "below" } {
  return { target: parseMoney(title), direction: parseDirection(title) };
}

function mentionsAsset(title: string, asset: string) {
  return assetNames(asset).some((n) => new RegExp(`(^|[^a-z])${n.toLowerCase()}([^a-z]|$)`, "i").test(title));
}

export function matchMarket(claimText: string, markets: CournotMarket[]): MatchResult {
  const claim = parseClaim(claimText);
  const live = markets.filter((m) => !m.market_info.end_time || new Date(m.market_info.end_time).getTime() > Date.now());
  const sameAsset = live.filter((m) => mentionsAsset(m.market_info.title, claim.asset));
  if (!sameAsset.length) {
    return { ok: false, reason: `No live prediction market covers ${claim.asset} for this call yet.`, claim, closest: markets.slice(0, 3) };
  }
  if (claim.target == null) {
    return { ok: true, mode: "loose", market: sameAsset[0], claim, marketTarget: parseMarket(sameAsset[0].market_info.title).target };
  }
  const t = claim.target;
  const parsed = sameAsset
    .map((m) => ({ m, ...parseMarket(m.market_info.title) }))
    .filter((x) => x.target != null && x.direction === claim.direction) as { m: CournotMarket; target: number; direction: string }[];

  const exact = parsed.find((x) => Math.abs(x.target - t) / t <= 0.02);
  if (exact) return { ok: true, mode: "exact", market: exact.m, claim, marketTarget: exact.target };

  // tightest easier market → upper bound
  const easier =
    claim.direction === "above"
      ? parsed.filter((x) => x.target < t).sort((a, b) => b.target - a.target)[0]
      : parsed.filter((x) => x.target > t).sort((a, b) => a.target - b.target)[0];
  if (easier) return { ok: true, mode: "bound", market: easier.m, claim, marketTarget: easier.target };

  return {
    ok: false,
    reason: `Markets for ${claim.asset} exist, but none at or below a ${claim.direction === "above" ? "$" + t.toLocaleString() + "+" : "sub-$" + t.toLocaleString()} target that would bound this call.`,
    claim,
    closest: sameAsset.slice(0, 3),
  };
}

export function modeLabel(mode: MatchMode, marketTarget: number | null) {
  if (mode === "exact") return "Exact market match";
  if (mode === "bound")
    return `Upper bound: priced via the easier $${marketTarget?.toLocaleString()} market. The real odds of this call are lower.`;
  return "Closest market (the call has no explicit price target)";
}
