"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { keccak256, toBytes } from "viem";
import { CournotError, getProbability, resolveMarkets, type CournotMarket, type CournotProbability } from "@/lib/cournot";
import { detectAsset, EXAMPLE_CALLS, normalizeHandle } from "@/lib/assets";
import { contextNotes, VERDICTS, verdictFor } from "@/lib/verdict";
import { pct, signed, usd } from "@/lib/format";
import { ReceiptSlip, type SlipData } from "./ReceiptSlip";
import { matchMarket, modeLabel, type MatchMode } from "@/lib/match";

type XPost = { url: string; handle: string; name: string; avatar: string | null; text: string; postedAt: number | null };

function cleanTweet(t: string) {
  return t.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 280);
}

type Snapshot = {
  asset: string;
  name: string;
  price: number;
  change1h: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  marketCap: number;
  rank: number;
  fearGreed: number;
  fearGreedLabel: string;
  btcDominance: number;
  fetchedAt: string;
};

type StepKey = "resolve" | "odds" | "market" | "anchor";
type StepState = "idle" | "run" | "done" | "error" | "skip";

const STEPS: { key: StepKey; title: string; sub: string }[] = [
  { key: "resolve", title: "Match a live prediction market", sub: "Cournot · /resolve" },
  { key: "odds", title: "Ask the Intelligence Oracle", sub: "Cournot · /probability" },
  { key: "market", title: "Pull live market context", sub: "CoinMarketCap Pro API" },
  { key: "anchor", title: "Anchor the receipt on BNB Chain", sub: "ReceiptRegistry · gas sponsored" },
];

const EXPLORER = "https://testnet.bscscan.com";

export function CheckFlow({
  initialClaim = "",
  initialCaller = "",
  initialSource = "",
  initialPosted = "",
}: {
  initialClaim?: string;
  initialCaller?: string;
  initialSource?: string;
  initialPosted?: string;
}) {
  const [claim, setClaim] = useState(initialClaim);
  const [caller, setCaller] = useState(initialCaller);
  const [sourceUrl, setSourceUrl] = useState(initialSource);
  const [postedAt, setPostedAt] = useState(initialPosted);
  const [apiKey, setApiKey] = useState("");
  const [showAdv, setShowAdv] = useState(false);
  const [steps, setSteps] = useState<Record<StepKey, StepState>>({ resolve: "idle", odds: "idle", market: "idle", anchor: "idle" });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<{ msg: string; kind?: string } | null>(null);
  const [markets, setMarkets] = useState<CournotMarket[]>([]);
  const [market, setMarket] = useState<CournotMarket | null>(null);
  const [odds, setOdds] = useState<CournotProbability | null>(null);
  const [raw, setRaw] = useState<string>("");
  const [fromCache, setFromCache] = useState<{ id: number; txHash: string } | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [mode, setMode] = useState<{ mode: MatchMode; target: number | null } | null>(null);
  const [xUrl, setXUrl] = useState("");
  const [xPost, setXPost] = useState<XPost | null>(null);
  const [xBusy, setXBusy] = useState(false);
  const [xErr, setXErr] = useState("");
  const [anchored, setAnchored] = useState<{ id: number; txHash: string } | null>(null);
  const [createdAt, setCreatedAt] = useState(() => Math.floor(Date.now() / 1000));
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem("cournot_key") ?? "");
  }, []);

  const set = (k: StepKey, s: StepState) => setSteps((p) => ({ ...p, [k]: s }));

  async function importX(link: string) {
    const u = link.trim();
    if (!u) return;
    setXBusy(true);
    setXErr("");
    try {
      const r = await fetch(`/api/xpost?url=${encodeURIComponent(u)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't import that post");
      setXPost(j);
      setClaim(cleanTweet(j.text));
      setCaller(j.handle);
      setSourceUrl(j.url);
      if (j.postedAt) setPostedAt(new Date(j.postedAt * 1000).toISOString().slice(0, 10));
    } catch (e) {
      setXErr((e as Error).message);
      setXPost(null);
    } finally {
      setXBusy(false);
    }
    
  }

  async function run(forcedMarket?: CournotMarket) {
    const c = claim.trim();
    if (c.length < 6) {
      setError({ msg: "Paste a real call first — e.g. “BNB above $700 before December”." });
      return;
    }
    setRunning(true);
    setError(null);
    setAnchored(null);
    setFromCache(null);
    setOdds(null);
    setSnap(null);
    setCreatedAt(Math.floor(Date.now() / 1000));
    setSteps({ resolve: "run", odds: "idle", market: "idle", anchor: "idle" });

    try {
      // 1. resolve + honest matching (never price a different bet than the one called)
      const pool = forcedMarket ? [forcedMarket] : await resolveMarkets(c, 10);
      if (!forcedMarket) setMarkets(pool);
      const m = matchMarket(c, pool);
      if (!m.ok) {
        setMarkets(m.closest);
        throw new CournotError("no_market", m.reason);
      }
      const pick = m.market;
      setMode({ mode: m.mode, target: m.marketTarget });
      setMarket(pick);
      set("resolve", "done");

      // 2. probability (browser → Cournot; falls back to the on-chain shared cache)
      set("odds", "run");
      let rawText = "";
      let parsed: CournotProbability;
      try {
        const r = await getProbability(c, [pick.market_info.id], apiKey || undefined);
        rawText = r.raw;
        parsed = r.parsed;
      } catch (e) {
        if (e instanceof CournotError && e.kind === "quota") {
          const cache = await fetch(`/api/cache?marketId=${pick.market_info.id}`).then((r) => r.json());
          if (cache?.hit && cache.raw) {
            rawText = cache.raw;
            parsed = JSON.parse(cache.raw);
            setFromCache({ id: cache.hit.id, txHash: cache.txHash });
          } else throw e;
        } else throw e;
      }
      setRaw(rawText);
      setOdds(parsed);
      set("odds", "done");

      // 3. CoinMarketCap
      set("market", "run");
      const asset = detectAsset(`${c} ${pick.market_info.title}`);
      const s = await fetch(`/api/market?asset=${asset}`).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "CoinMarketCap unavailable");
        return j as Snapshot;
      });
      setSnap(s);
      set("market", "done");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);

      // 4. anchor
      set("anchor", "run");
      const res = await fetch("/api/anchor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ claim: c, caller, raw: rawText, marketId: pick.market_info.id, sourceUrl, postedAt }),
      });
      const j = await res.json();
      if (!res.ok) {
        set("anchor", "error");
        setError({ msg: j.error || "Anchoring failed", kind: "anchor" });
      } else {
        setAnchored({ id: j.id, txHash: j.txHash });
        set("anchor", "done");
      }
    } catch (e) {
      const err = e as CournotError;
      setSteps((p) => {
        const n = { ...p };
        (Object.keys(n) as StepKey[]).forEach((k) => n[k] === "run" && (n[k] = "error"));
        return n;
      });
      setError({ msg: err.message || "Something went wrong", kind: err.kind });
    } finally {
      setRunning(false);
    }
  }

  const bps = odds ? Math.round(odds.data.probability * 10000) : 0;
  const verdict = verdictFor(bps);
  const evidenceHash = raw ? keccak256(toBytes(raw)) : undefined;

  const slip: SlipData | null =
    odds && market && snap
      ? {
          id: anchored?.id ?? null,
          claim: claim.trim(),
          caller: normalizeHandle(caller),
          asset: snap.asset,
          probabilityBps: bps,
          verdict,
          marketId: market.market_info.id,
          marketTitle: market.market_info.title,
          resolvesAt: Math.floor(new Date(market.market_info.end_time).getTime() / 1000) || 0,
          spotPrice: snap.price,
          change24h: snap.change24h,
          fearGreed: snap.fearGreed,
          createdAt,
          evidenceHash,
          txHash: anchored?.txHash,
          pending: steps.anchor === "run",
          bound: mode?.mode === "bound",
        }
      : null;

  const notes = useMemo(
    () => (snap && odds ? contextNotes({ fearGreed: snap.fearGreed, change24h: snap.change24h, change7d: snap.change7d, bps }) : []),
    [snap, odds, bps],
  );

  const shareUrl = anchored && typeof window !== "undefined" ? `${window.location.origin}/r/${anchored.id}` : "";
  const tweet = anchored
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `${normalizeHandle(caller)} called: "${claim.trim()}"\n\nPrediction markets give it ${pct(bps)} → ${VERDICTS[verdict].label}.\n\nReceipt anchored on BNB Chain 🧾`,
      )}&url=${encodeURIComponent(shareUrl)}`
    : "";

  return (
    <div>
      {/* ───── input ───── */}
      <div className="card relative overflow-hidden p-2">
        <div className="absolute inset-x-0 -top-24 h-48 glow-bnb opacity-60" />
        <div className="relative rounded-[14px] bg-ink-2/80 p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-ink px-4 py-2.5 focus-within:border-bnb/60">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-white/60" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <input
                value={xUrl}
                onChange={(e) => setXUrl(e.target.value)}
                onPaste={(e) => {
                  const t = e.clipboardData.getData("text");
                  if (/(x|twitter)\.com\/.+\/status\//i.test(t)) setTimeout(() => importX(t), 0);
                }}
                onKeyDown={(e) => e.key === "Enter" && importX(xUrl)}
                placeholder="Paste an X post link to import the call, author and date"
                className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-white/30"
              />
            </div>
            <button onClick={() => importX(xUrl)} disabled={xBusy || !xUrl.trim()} className="btn-ghost px-5 py-2.5 text-sm text-white/80 disabled:opacity-40">
              {xBusy ? "Importing…" : "Import post"}
            </button>
          </div>
          {xErr && <div className="mt-2 text-xs text-bad">{xErr}</div>}
          <AnimatePresence>
            {xPost && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex gap-3 rounded-xl border border-line bg-white/[0.03] p-3.5">
                {xPost.avatar && <img src={xPost.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full" />}
                <div className="min-w-0 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 text-white/85">
                    <b>{xPost.name}</b> <span className="font-mono text-xs text-white/45">{xPost.handle}</span>
                    {xPost.postedAt && <span className="font-mono text-xs text-white/35">· {new Date(xPost.postedAt * 1000).toISOString().slice(0, 10)}</span>}
                  </div>
                  <p className="mt-1 line-clamp-3 text-white/65">{xPost.text}</p>
                  <div className="mt-1 font-mono text-[10.5px] text-good">✓ imported: call, author, link and date filled in below (edit if needed)</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <label htmlFor="call-input" className="mt-5 block font-mono text-[11px] tracking-[0.25em] text-white/45">
            OR TYPE ANY CALL
          </label>
          <textarea
            id="call-input"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
            rows={2}
            maxLength={280}
            placeholder="e.g. STRK will hit $5 by December"
            className="mt-2 w-full resize-none rounded-xl border border-line bg-ink px-4 py-3 text-xl font-semibold leading-snug text-white caret-bnb outline-none transition placeholder:font-normal placeholder:text-white/25 focus:border-bnb/70 focus:shadow-[0_0_0_4px_rgba(240,185,11,0.12)] sm:text-2xl"
          />
          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-line bg-ink px-4 py-2.5">
              <span className="font-mono text-xs text-white/40">CALLED BY</span>
              <input
                value={caller}
                onChange={(e) => setCaller(e.target.value)}
                placeholder="@handle or x.com link"
                maxLength={60}
                className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/25"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-line bg-ink px-4 py-2.5">
              <span className="whitespace-nowrap font-mono text-xs text-white/40">ORIGINAL POST</span>
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://x.com/…/status/…  (stored on-chain)"
                maxLength={300}
                className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/25"
              />
            </div>
            <div className="flex items-center gap-2 rounded-full border border-line bg-ink px-4 py-2.5">
              <span className="font-mono text-xs text-white/40">POSTED</span>
              <input
                type="date"
                value={postedAt}
                onChange={(e) => setPostedAt(e.target.value)}
                className="bg-transparent font-mono text-sm text-white outline-none [color-scheme:dark]"
              />
            </div>
            <button onClick={() => run()} disabled={running} className="btn-bnb flex items-center justify-center gap-2 px-7 py-3 text-base">
              {running ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" /> Checking…
                </>
              ) : (
                <>Check the odds →</>
              )}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-white/35">OR TRY AN EXAMPLE</span>
            {EXAMPLE_CALLS.map((ex) => (
              <button
                key={ex.claim}
                onClick={() => {
                  setClaim(ex.claim);
                  setCaller(ex.caller);
                }}
                className="btn-ghost px-3 py-1 text-xs text-white/65"
              >
                {ex.claim}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAdv((s) => !s)} className="mt-4 font-mono text-[11px] text-white/35 hover:text-white/70">
            {showAdv ? "− " : "+ "}Have a Cournot API key? (optional)
          </button>
          <AnimatePresence>
            {showAdv && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value.trim());
                      localStorage.setItem("cournot_key", e.target.value.trim());
                    }}
                    placeholder="ck_live_… (stays in your browser only)"
                    className="flex-1 rounded-full border border-line bg-ink px-4 py-2 font-mono text-xs outline-none"
                  />
                </div>
                <p className="mt-2 text-xs text-white/40">
                  Only needed if the shared oracle quota runs out. It is forwarded to Cournot with your request and never stored.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ───── pipeline ───── */}
      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        {STEPS.map((s, i) => {
          const st = steps[s.key];
          return (
            <motion.div
              key={s.key}
              layout
              className={`card relative overflow-hidden p-4 transition-colors ${st === "run" ? "border-bnb/60" : st === "done" ? "border-good/30" : st === "error" ? "border-bad/50" : ""}`}
            >
              {st === "run" && <div className="shimmer absolute inset-0" />}
              <div className="relative flex items-center justify-between">
                <span className="font-mono text-[11px] text-white/40">0{i + 1}</span>
                <StepIcon state={st} />
              </div>
              <div className="relative mt-3 text-sm font-semibold">{s.title}</div>
              <div className="relative mt-1 font-mono text-[10.5px] text-white/40">{s.sub}</div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm"
          >
            <div className="font-semibold text-bad">{error.msg}</div>
            {error.kind === "quota" && (
              <p className="mt-1 text-white/65">
                The shared Cournot quota is used up and nobody has checked this market in the last 6 hours. Add your own Cournot key
                above, or{" "}
                <Link href="/ledger" className="text-bnb underline">
                  browse existing receipts
                </Link>
                .
              </p>
            )}
            {error.kind === "no_market" && (
              <div className="mt-1 text-white/65">
                <p>
                  We only print a receipt when a live prediction market actually prices the call (or an easier version of it that bounds
                  the odds). We won&apos;t pass off a different bet&apos;s odds as yours.
                </p>
                {markets.length > 0 && (
                  <div className="mt-3">
                    <div className="font-mono text-[11px] text-white/40">CLOSEST LIVE MARKETS (NOT THE SAME CALL)</div>
                    <ul className="mt-1.5 space-y-1 font-mono text-xs">
                      {markets.slice(0, 3).map((m) => (
                        <li key={m.market_info.id}>· {m.market_info.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── result ───── */}
      <div ref={resultRef} className="scroll-mt-24">
        <AnimatePresence>
          {slip && odds && snap && market && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 grid gap-10 lg:grid-cols-[440px_1fr]">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <ReceiptSlip data={slip} print key={`${market.market_info.id}-${createdAt}`} />
                <AnimatePresence>
                  {anchored && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex flex-wrap gap-2">
                      <Link href={`/r/${anchored.id}`} className="btn-bnb px-5 py-2.5 text-sm">
                        Open receipt page
                      </Link>
                      <a href={tweet} target="_blank" rel="noreferrer" className="btn-ghost px-5 py-2.5 text-sm">
                        Post on X
                      </a>
                      <button onClick={() => navigator.clipboard.writeText(shareUrl)} className="btn-ghost px-5 py-2.5 text-sm">
                        Copy link
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-5">
                {/* verdict banner */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="card overflow-hidden p-6"
                  style={{ borderColor: `${VERDICTS[verdict].color}55` }}
                >
                  <div className="font-mono text-[11px] tracking-[0.25em] text-white/45">VERDICT</div>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
                    <span className="text-5xl font-extrabold" style={{ color: VERDICTS[verdict].color }}>
                      {VERDICTS[verdict].label}
                    </span>
                    <span className="font-mono text-white/55">
                      {mode?.mode === "bound" ? "≤ " : ""}
                      {pct(bps, 1)} market-implied probability
                    </span>
                  </div>
                  <p className="mt-3 text-lg text-white/85">{VERDICTS[verdict].action}</p>
                  {mode && (
                    <p
                      className={`mt-3 rounded-lg px-3 py-2 text-xs ${mode.mode === "exact" ? "bg-good/10 text-good" : "bg-[#5ac8fa]/10 text-[#5ac8fa]"}`}
                    >
                      {modeLabel(mode.mode, mode.target)}
                    </p>
                  )}
                  {odds.data.free_quota && (
                    <p className="mt-3 font-mono text-[11px] text-white/35">
                      {odds.data.free_quota.remaining} free Cournot checks left in the shared quota
                    </p>
                  )}
                  {fromCache && (
                    <p className="mt-3 rounded-lg bg-bnb/10 px-3 py-2 text-xs text-bnb">
                      Served from the on-chain cache: someone checked this market recently (receipt #{fromCache.id}). Same evidence, same hash.
                    </p>
                  )}
                </motion.div>

                {/* Cournot claim + evidence */}
                <Panel title="Claim evaluated by Cournot" badge="SOURCE · COURNOT INTELLIGENCE ORACLE">
                  <div className="rounded-xl bg-white/[0.03] p-4">
                    <div className="font-mono text-[11px] text-white/40">MARKET #{market.market_info.id}</div>
                    <div className="mt-1 text-lg font-semibold">{market.market_info.title}</div>
                    <div className="mt-2 flex flex-wrap gap-4 font-mono text-xs text-white/50">
                      <span>probability {odds.data.probability}</span>
                      <span>ends {market.market_info.end_time?.replace("T", " ").replace("Z", " UTC")}</span>
                      {markets[0] && <span>match {(markets.find((m) => m.market_info.id === market.market_info.id)?.matching_confidence ?? 0).toFixed(2)}</span>}
                    </div>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {(odds.data.basis ?? []).map((b, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.08 }}
                        className="flex gap-3 rounded-xl border border-line p-3.5"
                      >
                        <span className="mt-0.5 h-fit rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-bnb">
                          {b.source}
                        </span>
                        <div className="min-w-0 text-sm leading-relaxed text-white/80">
                          {b.summary}
                          <div className="mt-1 flex gap-3 font-mono text-[10.5px] text-white/35">
                            <span>{b.time}</span>
                            {b.url && (
                              <a href={b.url} target="_blank" rel="noreferrer" className="truncate hover:text-bnb">
                                source ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                  {markets.length > 1 && !fromCache && (
                    <div className="mt-4">
                      <div className="font-mono text-[11px] text-white/40">OTHER MATCHING MARKETS</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {markets
                          .filter((m) => m.market_info.id !== market.market_info.id)
                          .slice(0, 3)
                          .map((m) => (
                            <button
                              key={m.market_info.id}
                              disabled={running}
                              onClick={() => run(m)}
                              className="btn-ghost px-3 py-1.5 text-left text-xs text-white/70"
                              title="Re-check against this market (uses one Cournot check)"
                            >
                              {m.market_info.title} <span className="text-white/35">· {m.matching_confidence.toFixed(2)}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </Panel>

                {/* our analysis — explicitly labelled as added by the app */}
                <Panel title="What to do about it" badge="ADDED BY RECEIPTS · NOT FROM COURNOT">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white/[0.03] p-4">
                      <div className="font-mono text-[11px] text-white/40">RULE (ENFORCED ON-CHAIN)</div>
                      <div className="mt-2 space-y-1 font-mono text-xs text-white/70">
                        <div className={verdict === "LIKELY" ? "text-good" : ""}>p ≥ 65% → LIKELY</div>
                        <div className={verdict === "COIN_FLIP" ? "text-bnb" : ""}>35–65% → COIN FLIP</div>
                        <div className={verdict === "UNLIKELY" ? "text-warn" : ""}>10–35% → UNLIKELY</div>
                        <div className={verdict === "DELUSIONAL" ? "text-bad" : ""}>p &lt; 10% → DELUSIONAL</div>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-4">
                      <div className="font-mono text-[11px] text-white/40">POSITION SIZING</div>
                      <p className="mt-2 text-sm text-white/80">{VERDICTS[verdict].sizing}</p>
                    </div>
                  </div>
                  {notes.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {notes.map((n) => (
                        <li key={n} className="flex gap-2 text-sm text-white/70">
                          <span className="text-bnb">→</span>
                          {n}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                {/* CMC */}
                <Panel title={`${snap.name} right now`} badge="SOURCE · COINMARKETCAP PRO API">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metric k="Price" v={usd(snap.price)} />
                    <Metric k="24h" v={signed(snap.change24h)} tone={snap.change24h} />
                    <Metric k="7d" v={signed(snap.change7d)} tone={snap.change7d} />
                    <Metric k="Rank" v={`#${snap.rank}`} />
                    <Metric k="Volume 24h" v={usd(snap.volume24h)} />
                    <Metric k="Market cap" v={usd(snap.marketCap)} />
                    <Metric k="Fear & Greed" v={`${snap.fearGreed} · ${snap.fearGreedLabel}`} />
                    <Metric k="BTC dominance" v={`${snap.btcDominance.toFixed(1)}%`} />
                  </div>
                </Panel>

                {/* chain */}
                <Panel title="Proof on BNB Chain" badge="BSC TESTNET · REGISTRY">
                  <div className="space-y-2 font-mono text-xs">
                    <KV k="evidence keccak256" v={evidenceHash ?? "—"} />
                    <KV k="evidence bytes" v={`${raw.length}`} />
                    <KV
                      k="transaction"
                      v={
                        anchored ? (
                          <span>
                            <Link className="text-bnb hover:underline" href={`/explorer/tx/${anchored.txHash}`}>
                              {anchored.txHash}
                            </Link>{" "}
                            <a className="text-white/40 hover:text-white" target="_blank" rel="noreferrer" href={`${EXPLORER}/tx/${anchored.txHash}`}>
                              BscScan ↗
                            </a>
                          </span>
                        ) : steps.anchor === "run" ? (
                          <span className="text-white/50">broadcasting…</span>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <KV k="receipt id" v={anchored ? `#${anchored.id}` : "—"} />
                    <KV k="original post" v={sourceUrl ? sourceUrl : "— (add one to tie the call to its author)"} />
                  </div>
                  <details className="mt-4 rounded-xl border border-line p-3">
                    <summary className="cursor-pointer font-mono text-[11px] text-white/50">Raw Cournot response (exactly what gets hashed)</summary>
                    <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[10.5px] text-white/55">{raw}</pre>
                  </details>
                </Panel>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "run") return <span className="h-4 w-4 animate-spin rounded-full border-2 border-bnb border-t-transparent" />;
  if (state === "done")
    return (
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid h-5 w-5 place-items-center rounded-full bg-good text-[11px] font-bold text-ink">
        ✓
      </motion.span>
    );
  if (state === "error") return <span className="grid h-5 w-5 place-items-center rounded-full bg-bad text-[11px] font-bold text-ink">!</span>;
  return <span className="h-2 w-2 rounded-full bg-white/20" />;
}

function Panel({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">{title}</h3>
        <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] tracking-wider text-white/45">{badge}</span>
      </div>
      {children}
    </motion.section>
  );
}

function Metric({ k, v, tone }: { k: string; v: string; tone?: number }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3">
      <div className="font-mono text-[10.5px] uppercase text-white/40">{k}</div>
      <div className={`mt-1 font-semibold ${tone === undefined ? "" : tone >= 0 ? "text-good" : "text-bad"}`}>{v}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line/60 pb-2 sm:flex-row sm:gap-4">
      <span className="w-40 shrink-0 text-white/40">{k}</span>
      <span className="min-w-0 break-all text-white/80">{v}</span>
    </div>
  );
}
