import Link from "next/link";
import { notFound } from "next/navigation";
import { EXPLORER, getEvidence, getReceipt, REGISTRY } from "@/lib/chain";
import { ReceiptSlip } from "@/components/ReceiptSlip";
import { VerifyEvidence } from "@/components/VerifyEvidence";
import { Reveal } from "@/components/Motion";
import { VerdictPill } from "@/components/ReceiptCard";
import { VERDICTS, contextNotes } from "@/lib/verdict";
import { day, pct, receiptNo, sourceLabel, stamp } from "@/lib/format";
import type { CournotProbability } from "@/lib/cournot";
import { matchMarket, modeLabel } from "@/lib/match";

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getReceipt(Number(id)).catch(() => null);
  if (!r) return { title: "Receipt — RECEIPTS" };
  return {
    title: `${r.caller}: “${r.claim}” — ${pct(r.probabilityBps)} · RECEIPTS`,
    description: `Prediction markets priced this call at ${pct(r.probabilityBps)} (${VERDICTS[r.verdict].label}). Anchored on BNB Chain.`,
  };
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 0) notFound();
  const r = await getReceipt(n);
  if (!r) notFound();
  const ev = await getEvidence(r).catch(() => null);
  let parsed: CournotProbability | null = null;
  try {
    parsed = ev ? JSON.parse(ev.json) : null;
  } catch {}
  const market = parsed?.data?.markets?.find((m) => m.market_info.id === r.marketId) ?? parsed?.data?.markets?.[0];
  const notes = contextNotes({ fearGreed: r.fearGreed, bps: r.probabilityBps });
  const mm = market ? matchMarket(r.claim, [market]) : null;
  const bound = Boolean(mm && mm.ok && mm.mode === "bound");

  return (
    <div className="mx-auto max-w-7xl px-5 pt-14">
      <Link href="/ledger" className="font-mono text-xs text-white/45 hover:text-white">
        ← LEDGER
      </Link>
      <div className="mt-6 grid gap-12 lg:grid-cols-[440px_1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ReceiptSlip
            print
            data={{
              ...r,
              marketTitle: market?.market_info.title,
              txHash: ev?.txHash,
              bound,
            }}
          />
        </div>
        <div className="space-y-5">
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-white/45">RECEIPT {receiptNo(r.id)}</span>
              <VerdictPill verdict={r.verdict} />
            </div>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-5xl">&ldquo;{r.claim}&rdquo;</h1>
            <p className="mt-4 text-white/55">
              Called by{" "}
              <Link href={`/caller/${encodeURIComponent(r.caller)}`} className="font-mono text-bnb hover:underline">
                {r.caller}
              </Link>{" "}
              · anchored {stamp(r.createdAt)} · prediction markets priced it at{" "}
              <span className="font-bold" style={{ color: VERDICTS[r.verdict].color }}>
                {bound ? "≤ " : ""}
                {pct(r.probabilityBps, 1)}
              </span>
            </p>
          </Reveal>

          <Reveal>
            {r.source ? (
              <a
                href={r.source.url}
                target="_blank"
                rel="noreferrer nofollow"
                className="card group flex items-center justify-between gap-4 p-5 transition hover:border-bnb/50"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[11px] tracking-widest text-white/40">
                    ORIGINAL {sourceLabel(r.source.url).platform.toUpperCase()} · PROVENANCE ON-CHAIN (SOURCEFACET)
                  </div>
                  <div className="mt-1.5 truncate font-mono text-sm text-bnb group-hover:underline">{r.source.url}</div>
                  {r.source.postedAt > 0 && (
                    <div className="mt-1 text-xs text-white/45">
                      Posted {day(r.source.postedAt)} · receipt printed {Math.max(0, Math.round((r.createdAt - r.source.postedAt) / 86400))} days later
                    </div>
                  )}
                </div>
                <span className="btn-bnb shrink-0 px-4 py-2 text-sm">View post ↗</span>
              </a>
            ) : (
              <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-white/45">
                Community submission: no link to an original post was attached to this receipt.
              </div>
            )}
          </Reveal>

          {parsed && (
            <Reveal>
              <section className="card p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">Evidence from Cournot</h2>
                  <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-white/45">
                    SOURCE · COURNOT INTELLIGENCE ORACLE
                  </span>
                </div>
                {market && (
                  <div className="rounded-xl bg-white/[0.03] p-4">
                    <div className="font-mono text-[11px] text-white/40">CLAIM EVALUATED · MARKET #{market.market_info.id}</div>
                    <div className="mt-1 font-semibold">{market.market_info.title}</div>
                    <div className="mt-1 font-mono text-xs text-white/45">probability {parsed.data.probability}</div>
                    {mm && mm.ok && (
                      <div className={`mt-2 inline-block rounded-md px-2 py-1 text-xs ${bound ? "bg-[#5ac8fa]/10 text-[#5ac8fa]" : "bg-good/10 text-good"}`}>
                        {modeLabel(mm.mode, mm.marketTarget)}
                      </div>
                    )}
                  </div>
                )}
                <ul className="mt-4 space-y-3">
                  {(parsed.data.basis ?? []).map((b, i) => (
                    <li key={i} className="flex gap-3 rounded-xl border border-line p-3.5">
                      <span className="h-fit rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase text-bnb">{b.source}</span>
                      <div className="text-sm leading-relaxed text-white/80">
                        {b.summary}
                        {b.url && (
                          <a href={b.url} target="_blank" rel="noreferrer" className="ml-2 font-mono text-[10.5px] text-white/35 hover:text-bnb">
                            source ↗
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          )}

          <Reveal>
            <section className="card p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">What it means</h2>
                <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-white/45">ADDED BY RECEIPTS · NOT FROM COURNOT</span>
              </div>
              <p className="text-lg">{VERDICTS[r.verdict].action}</p>
              <p className="mt-2 text-white/60">{VERDICTS[r.verdict].sizing}</p>
              <ul className="mt-3 space-y-1.5">
                {notes.map((x) => (
                  <li key={x} className="text-sm text-white/60">
                    <span className="text-bnb">→ </span>
                    {x}
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          <Reveal>
            <section className="card p-6">
              <h2 className="text-lg font-bold">Don&apos;t trust us. Verify.</h2>
              <p className="mt-2 text-sm text-white/55">
                The full Cournot response was emitted on-chain in the anchoring transaction. Its keccak256 is stored in the receipt. Recompute
                it yourself:
              </p>
              <div className="mt-4 space-y-2 font-mono text-xs">
                <Row k="diamond" v={<a className="text-bnb hover:underline" target="_blank" rel="noreferrer" href={`${EXPLORER}/address/${REGISTRY}`}>{REGISTRY} ↗</a>} />
                {ev && (
                  <Row
                    k="transaction"
                    v={
                      <span>
                        <Link className="text-bnb hover:underline" href={`/explorer/tx/${ev.txHash}`}>{ev.txHash}</Link>{" "}
                        <a className="text-white/40 hover:text-white" target="_blank" rel="noreferrer" href={`${EXPLORER}/tx/${ev.txHash}`}>BscScan ↗</a>
                      </span>
                    }
                  />
                )}
                <Row k="block" v={String(r.blockNumber)} />
                <Row k="attester" v={r.attester} />
                <Row k="evidence hash" v={r.evidenceHash} />
              </div>
              {ev && (
                <div className="mt-5">
                  <VerifyEvidence json={ev.json} expected={r.evidenceHash} />
                  <details className="mt-4 rounded-xl border border-line p-3">
                    <summary className="cursor-pointer font-mono text-[11px] text-white/50">Raw evidence pulled from the event log</summary>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-[10.5px] text-white/55">{ev.json}</pre>
                  </details>
                </div>
              )}
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line/60 pb-2 sm:flex-row sm:gap-4">
      <span className="w-32 shrink-0 text-white/40">{k}</span>
      <span className="min-w-0 break-all text-white/80">{v}</span>
    </div>
  );
}
