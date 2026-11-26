import Link from "next/link";
import type { ReceiptView } from "@/lib/chain";
import { VERDICTS } from "@/lib/verdict";
import { ago, day, pct, receiptNo, sourceLabel, usd } from "@/lib/format";

export function VerdictPill({ verdict, className = "" }: { verdict: keyof typeof VERDICTS; className?: string }) {
  const v = VERDICTS[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10.5px] font-bold tracking-wider ${className}`}
      style={{ color: v.color, background: `${v.color}18`, boxShadow: `inset 0 0 0 1px ${v.color}40` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.color }} />
      {v.label}
    </span>
  );
}

export function ReceiptCard({ r }: { r: ReceiptView }) {
  const v = VERDICTS[r.verdict];
  return (
    <Link
      href={`/r/${r.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-line bg-ink-2 p-5 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${v.color}, transparent)` }} />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-white/40">{receiptNo(r.id)}</span>
        <VerdictPill verdict={r.verdict} />
      </div>
      <p className="mt-4 line-clamp-3 text-[17px] font-semibold leading-snug text-white/90">&ldquo;{r.claim}&rdquo;</p>
      {r.source ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 font-mono text-[10.5px] text-white/55">
          <span className="text-good">●</span> {sourceLabel(r.source.url).platform} · {sourceLabel(r.source.url).host}
          {r.source.postedAt ? ` · ${day(r.source.postedAt)}` : ""}
        </div>
      ) : (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10.5px] text-white/30 ring-1 ring-white/10">
          community submission · no source
        </div>
      )}
      <div className="mt-5 flex items-end justify-between">
        <div>
          <div className="font-mono text-xs text-bnb">{r.caller}</div>
          <div className="mt-1 font-mono text-[10.5px] text-white/35">
            {r.asset} @ {usd(r.spotPrice)} · {ago(r.createdAt)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold leading-none" style={{ color: v.color }}>
            {pct(r.probabilityBps)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-white/35">MARKET ODDS</div>
        </div>
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all duration-700 group-hover:opacity-100" style={{ width: `${Math.max(2, r.probabilityBps / 100)}%`, background: v.color, opacity: 0.8 }} />
      </div>
      {r.outcome !== "PENDING" && (
        <div className={`mt-3 font-mono text-[11px] font-bold ${r.outcome === "HIT" ? "text-good" : "text-bad"}`}>
          {r.outcome === "HIT" ? "✔ CALL HIT" : "✘ CALL MISSED"}
        </div>
      )}
    </Link>
  );
}

export function EmptyLedger() {
  return (
    <div className="rounded-2xl border border-dashed border-line p-10 text-center">
      <div className="text-lg font-semibold">The ledger is waiting for its first receipt.</div>
      <p className="mt-2 text-sm text-white/50">Be the one who checks the next big call.</p>
      <Link href="/check" className="btn-bnb mt-5 inline-block px-5 py-2.5 text-sm">
        Check a call
      </Link>
    </div>
  );
}
