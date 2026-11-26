import Link from "next/link";
import { Ticker } from "@/components/Ticker";
import { HeroForm } from "@/components/HeroForm";
import { ReceiptSlip, type SlipData } from "@/components/ReceiptSlip";
import { CountUp, FloatSlip, Reveal } from "@/components/Motion";
import { ReceiptCard, EmptyLedger } from "@/components/ReceiptCard";
import { FearGauge } from "@/components/FearGauge";
import { getLatest, getTotals, type ReceiptView } from "@/lib/chain";
import { getSnapshot, type MarketSnapshot } from "@/lib/cmc";

export const revalidate = 15;

// A real Cournot response captured during the build (proof/cournot-probability-response.json),
// shown only until the on-chain ledger has receipts of its own.
const EXAMPLE: SlipData = {
  id: null,
  claim: "BNB will be above $685 by tomorrow night",
  caller: "@example",
  asset: "BNB",
  probabilityBps: 400,
  verdict: "DELUSIONAL",
  marketId: 112834,
  marketTitle: "BNB price above $685.00 at 2026-11-27 22:00 UTC",
  resolvesAt: 1795816800,
  spotPrice: 556.46,
  change24h: 0.4,
  fearGreed: 10,
  createdAt: 1795728479,
  evidenceHash: "0xf0c7c56bf69df78f4fc5274142631c94fd07897b2621e803589846c5f27b73c5",
};

function toSlip(r: ReceiptView): SlipData {
  return { ...r, marketTitle: undefined };
}

export default async function Home() {
  const [latest, totals, snap] = await Promise.all([
    getLatest(0, 9).catch(() => [] as ReceiptView[]),
    getTotals().catch(() => ({ receipts: 0, callers: 0 })),
    getSnapshot("BNB").catch(() => null as MarketSnapshot | null),
  ]);
  const avgOdds = latest.length ? latest.reduce((a, r) => a + r.probabilityBps, 0) / latest.length / 100 : 0;
  const delusional = latest.filter((r) => r.verdict === "DELUSIONAL" || r.verdict === "UNLIKELY").length;
  const front = latest[0] ? toSlip(latest[0]) : EXAMPLE;
  const back = latest[1] ? toSlip(latest[1]) : null;

  return (
    <>
      <Ticker />
      {/* ───────── HERO ───────── */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0" />
        <div className="glow-bnb absolute -right-40 top-10 h-[520px] w-[520px] opacity-50" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 pb-24 pt-16 lg:grid-cols-[1.15fr_1fr] lg:pt-24">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-2 px-3 py-1.5 font-mono text-[11px] tracking-wider text-white/60">
                <span className="live-dot" /> COURNOT ODDS × COINMARKETCAP × BNB CHAIN
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-6 text-[clamp(2.6rem,5.6vw,4.9rem)] font-extrabold leading-[0.95] tracking-tight">
                Every crypto call
                <br />
                gets a <span className="text-gradient-bnb">receipt.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
                Influencers post price targets. You lose money. Nobody keeps score. Paste any call and RECEIPTS prices it against live
                prediction markets, tells you what to do, then prints a{" "}
                <span className="text-white">permanent, tamper-proof receipt on BNB Chain</span>, tied to whoever made it.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <HeroForm />
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-white/40">
                <span>✓ No wallet needed</span>
                <span>✓ Zero gas, sponsored</span>
                <span>✓ Free to use</span>
                <span>✓ Verifiable forever</span>
              </div>
            </Reveal>
          </div>

          <div className="relative mx-auto h-[620px] w-full max-w-[420px]">
            {back && (
              <FloatSlip delay={0.5} rotate={7} className="absolute left-10 top-10 w-[88%] opacity-70 blur-[0.5px]">
                <ReceiptSlip data={back} compact />
              </FloatSlip>
            )}
            <FloatSlip delay={0.2} rotate={-4} className="absolute left-0 top-0 w-full">
              <ReceiptSlip data={front} print />
            </FloatSlip>
          </div>
        </div>
      </section>

      {/* ───────── STATS ───────── */}
      <section className="border-y border-line/60 bg-ink-2/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 md:grid-cols-4">
          {[
            { k: "Receipts on-chain", v: totals.receipts, s: "" },
            { k: "Callers on the record", v: totals.callers, s: "" },
            { k: "Avg. odds of recent calls", v: avgOdds, s: "%", d: 1 },
            { k: "Recent calls that are long shots", v: delusional, s: `/${latest.length || 0}` },
          ].map((x) => (
            <div key={x.k} className="px-2 py-8 md:px-6">
              <div className="text-4xl font-extrabold tracking-tight md:text-5xl">
                <CountUp to={x.v} suffix={x.s} decimals={x.d ?? 0} />
              </div>
              <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-white/40">{x.k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── PROBLEM ───────── */}
      <section className="mx-auto max-w-7xl px-5 py-28">
        <Reveal>
          <div className="font-mono text-xs tracking-[0.3em] text-bnb">THE PROBLEM</div>
          <h2 className="mt-4 max-w-4xl text-4xl font-bold leading-tight md:text-6xl">
            Crypto runs on <span className="text-white/35">unaccountable</span> price calls.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            { n: "01", t: "Calls are free to make", d: "“$BNB to $1,000.” Posted, liked, forgotten. If it misses, it's deleted. If it hits, it's pinned forever." },
            { n: "02", t: "Retail can't price them", d: "Is that target likely, or a 4% long shot? Prediction markets already know, but nobody checks before aping in." },
            { n: "03", t: "Nobody keeps score", d: "There is no neutral, permanent record of who called what, at what odds, and whether they were right." },
          ].map((x, i) => (
            <Reveal key={x.n} delay={i * 0.08}>
              <div className="card h-full p-7">
                <div className="font-mono text-sm text-bnb">{x.n}</div>
                <div className="mt-6 text-2xl font-bold">{x.t}</div>
                <p className="mt-3 leading-relaxed text-white/55">{x.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────── HOW ───────── */}
      <section className="relative overflow-hidden border-y border-line/60 bg-ink-2/40 py-28">
        <div className="mx-auto max-w-7xl px-5">
          <Reveal>
            <div className="font-mono text-xs tracking-[0.3em] text-bnb">HOW IT WORKS</div>
            <h2 className="mt-4 text-4xl font-bold md:text-6xl">Ten seconds from hype to receipt.</h2>
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-4">
            {[
              { t: "Paste the call", d: "Any price target, from any account, in plain English.", tag: "YOU" },
              { t: "Price it", d: "Cournot's Intelligence Oracle matches a live prediction market and returns a probability with sourced evidence.", tag: "COURNOT" },
              { t: "Contextualise it", d: "Live CoinMarketCap price, momentum, volume and Fear & Greed turn odds into an action and position size.", tag: "COINMARKETCAP" },
              { t: "Receipt it", d: "The verdict, odds and the full evidence are written to our EIP-2535 Diamond on BNB Chain. Gas is on us.", tag: "BNB CHAIN" },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 0.08}>
                <div className="relative h-full rounded-2xl border border-line bg-ink p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-bnb font-mono font-bold text-ink">{i + 1}</span>
                    <span className="font-mono text-[10px] tracking-widest text-white/35">{x.tag}</span>
                  </div>
                  <div className="mt-6 text-xl font-bold">{x.t}</div>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{x.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── LIVE LEDGER + SENTIMENT ───────── */}
      <section className="mx-auto max-w-7xl px-5 py-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Reveal>
            <div className="font-mono text-xs tracking-[0.3em] text-bnb">LIVE FROM THE LEDGER</div>
            <h2 className="mt-4 text-4xl font-bold md:text-5xl">Fresh receipts</h2>
          </Reveal>
          <Link href="/ledger" className="btn-ghost px-5 py-2.5 text-sm">
            Full ledger →
          </Link>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_300px]">
          {latest.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {latest.slice(0, 6).map((r, i) => (
                <Reveal key={r.id} delay={i * 0.05}>
                  <ReceiptCard r={r} />
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyLedger />
          )}
          {snap && (
            <Reveal>
              <div className="card sticky top-24 p-6 text-center">
                <div className="font-mono text-[11px] tracking-widest text-white/40">MARKET MOOD · CMC</div>
                <div className="mt-5">
                  <FearGauge value={snap.fearGreed} label={snap.fearGreedLabel} />
                </div>
                <p className="mt-5 text-sm leading-relaxed text-white/55">
                  Fear distorts calls: moonshot targets get louder exactly when they are least likely. RECEIPTS reads the mood into every
                  verdict.
                </p>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="mx-auto max-w-7xl px-5">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] border border-bnb/30 bg-gradient-to-br from-bnb/15 via-ink-2 to-ink p-10 md:p-16">
            <div className="glow-bnb absolute -right-20 -top-20 h-80 w-80" />
            <h2 className="relative max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">Saw a call today? Get it on the record.</h2>
            <p className="relative mt-4 max-w-xl text-white/60">
              Free, no wallet, no sign-up. Every receipt you print makes crypto a little more honest.
            </p>
            <div className="relative mt-8 flex flex-wrap gap-3">
              <Link href="/check" className="btn-bnb px-7 py-3.5">
                Check a call →
              </Link>
              <Link href="/hall" className="btn-ghost px-7 py-3.5">
                See the Hall of Hype
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
