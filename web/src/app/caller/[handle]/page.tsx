import Link from "next/link";
import { getCaller, getCallerReceipts, type ReceiptView } from "@/lib/chain";
import { ReceiptCard } from "@/components/ReceiptCard";
import { CountUp, Reveal } from "@/components/Motion";
import { normalizeHandle } from "@/lib/assets";
import { VERDICT_ORDER, VERDICTS } from "@/lib/verdict";

export const revalidate = 15;

export default async function CallerPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await params;
  const handle = normalizeHandle(decodeURIComponent(raw));
  const [c, rows] = await Promise.all([getCaller(handle).catch(() => null), getCallerReceipts(handle).catch(() => [] as ReceiptView[])]);
  const mix = VERDICT_ORDER.map((k) => ({ k, n: rows.filter((r) => r.verdict === k).length }));
  const total = rows.length || 1;

  return (
    <div className="mx-auto max-w-7xl px-5 pt-14">
      <Link href="/hall" className="font-mono text-xs text-white/45 hover:text-white">
        ← HALL OF HYPE
      </Link>
      <Reveal>
        <div className="mt-6 font-mono text-xs tracking-[0.3em] text-bnb">CALLER RECORD</div>
        <h1 className="mt-3 font-mono text-4xl font-extrabold md:text-6xl">{handle}</h1>
      </Reveal>

      {!c ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-10 text-center text-white/55">
          No receipts for {handle} yet.{" "}
          <Link className="text-bnb underline" href={`/check?by=${encodeURIComponent(handle)}`}>
            Check one of their calls.
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { k: "Calls on record", v: c.calls, s: "", d: 0 },
              { k: "Avg market odds", v: c.avgBps / 100, s: "%", d: 1 },
              { k: "Hits / misses", v: c.hits, s: ` / ${c.misses}`, d: 0 },
              { k: "Alpha score", v: c.alphaBps / 100, s: "", d: 1 },
            ].map((x) => (
              <Reveal key={x.k}>
                <div className="card p-6">
                  <div className="text-4xl font-extrabold">
                    <CountUp to={x.v} suffix={x.s} decimals={x.d} />
                  </div>
                  <div className="mt-2 font-mono text-[11px] uppercase text-white/40">{x.k}</div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="card mt-6 p-6">
              <div className="font-mono text-[11px] uppercase tracking-wider text-white/40">Verdict mix</div>
              <div className="mt-4 flex h-4 overflow-hidden rounded-full">
                {mix.map(({ k, n }) => (n ? <div key={k} style={{ width: `${(n / total) * 100}%`, background: VERDICTS[k].color }} title={`${VERDICTS[k].label}: ${n}`} /> : null))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 font-mono text-xs">
                {mix.map(({ k, n }) => (
                  <span key={k} className="flex items-center gap-2 text-white/60">
                    <span className="h-2 w-2 rounded-full" style={{ background: VERDICTS[k].color }} />
                    {VERDICTS[k].label} {n}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r, i) => (
              <Reveal key={r.id} delay={Math.min(i, 8) * 0.04}>
                <ReceiptCard r={r} />
              </Reveal>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
