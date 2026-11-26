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

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Best-effort deadline from free text ("by December", "end of 2027", "mid-2027", "this year"). ms epoch or null. */
export function parseDeadline(text: string, now = new Date()): number | null {
  const t = text.toLowerCase();
  const y = now.getUTCFullYear();
  const endOfYear = (yr: number) => Date.UTC(yr, 11, 31, 23, 59);
  if (/\btomorrow\b/.test(t)) return now.getTime() + 36 * 3600e3;
  if (/\bthis week\b/.test(t)) return now.getTime() + 7 * 86400e3;
  if (/\bthis month\b/.test(t)) return Date.UTC(y, now.getUTCMonth() + 1, 0, 23, 59);
  if (/\bthis year\b|\beoy\b|\byear[- ]end\b|\bend[- ]year\b/.test(t) && !/\b20\d\d\b/.test(t)) return endOfYear(y);
  if (/\bnext year\b/.test(t)) return endOfYear(y + 1);
  const mid = t.match(/\bmid[- ]?(20\d\d)\b/);
  if (mid) return Date.UTC(Number(mid[1]), 5, 30, 23, 59);
  const before = t.match(/\bbefore (20\d\d)\b/);
  if (before) return Date.UTC(Number(before[1]), 0, 1);
  const mon = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+(\d{1,2})(?:st|nd|rd|th)?)?(?:,?\s+(20\d\d))?\b/);
  if (mon && /\b(by|before|in|until|till|end of|on)\b/.test(t)) {
    const mi = MONTHS.indexOf(mon[1]);
    let yr = mon[3] ? Number(mon[3]) : y;
    if (!mon[3] && mi < now.getUTCMonth()) yr += 1;
    if (mon[2]) return Date.UTC(yr, mi, Number(mon[2]), 23, 59);
    return Date.UTC(yr, mi + 1, 0, 23, 59);
  }
  const yr = t.match(/\b(20\d\d)\b/);
  if (yr) return endOfYear(Number(yr[1]));
  return null;
}

export function parseClaim(claim: string): Parsed & { deadline: number | null } {
  return { asset: detectAsset(claim), target: parseMoney(claim), direction: parseDirection(claim), deadline: parseDeadline(claim) };
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
  const DAY = 86400e3;
  const endOf = (m: CournotMarket) => (m.market_info.end_time ? new Date(m.market_info.end_time).getTime() : Infinity);
  // A market that closes BEFORE the call's deadline understates the call — never usable.
  const timely = (m: CournotMarket) => claim.deadline == null || endOf(m) >= claim.deadline - 10 * DAY;
  // A market that runs much LONGER than the call is easier to win — only an upper bound.
  const longer = (m: CournotMarket) => claim.deadline != null && endOf(m) > claim.deadline + 45 * DAY;
  const parsed = sameAsset
    .filter(timely)
    .map((m) => ({ m, ...parseMarket(m.market_info.title) }))
    .filter((x) => x.target != null && x.direction === claim.direction) as { m: CournotMarket; target: number; direction: string }[];

  if (!parsed.length && sameAsset.length) {
    return { ok: false, reason: `${claim.asset} markets exist, but they all close before this call's deadline, so they can't price it.`, claim, closest: sameAsset.slice(0, 3) };
  }

  const exactAny = parsed.find((x) => Math.abs(x.target - t) / t <= 0.02);
  if (exactAny && longer(exactAny.m)) return { ok: true, mode: "bound", market: exactAny.m, claim, marketTarget: exactAny.target };
  const exact = exactAny;
  // "close above / be at $X at year-end" is harder than "touch $X at any time": an any-time market only bounds it.
  const pointInTime = /\b(close|closes|closing|year-end|end-year|year end)\b|\bbe at\b|\bat the end\b/i.test(claimText);
  if (exact && pointInTime && /at any time/i.test(exact.m.market_info.title) && claim.direction === "above")
    return { ok: true, mode: "bound", market: exact.m, claim, marketTarget: exact.target };
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
    return `Upper bound: priced via an easier market ($${marketTarget?.toLocaleString()}, or "touch at any time" rather than a close). The real odds of this call are at most this.`;
  return "Closest market (the call has no explicit price target)";
}
