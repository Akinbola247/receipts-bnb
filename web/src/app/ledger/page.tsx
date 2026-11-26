import Link from "next/link";
import { getLatest, getTotals, REGISTRY, type ReceiptView } from "@/lib/chain";
import { ReceiptCard, EmptyLedger } from "@/components/ReceiptCard";
import { Reveal } from "@/components/Motion";
import { VERDICT_ORDER, VERDICTS, type VerdictKey } from "@/lib/verdict";

export const revalidate = 10;
export const metadata = { title: "Ledger — RECEIPTS" };

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ v?: string; page?: string; src?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const PER = 24;
  const [rows, totals] = await Promise.all([
    getLatest(page * PER, PER).catch(() => [] as ReceiptView[]),
    getTotals().catch(() => ({ receipts: 0, callers: 0 })),
  ]);
  const filter = VERDICT_ORDER.includes(sp.v as VerdictKey) ? (sp.v as VerdictKey) : null;
  const sourcedOnly = sp.src === "1";
  const shown = (filter ? rows.filter((r) => r.verdict === filter) : rows).filter((r) => !sourcedOnly || r.source);
  const sourcedCount = rows.filter((r) => r.source).length;
  const counts = VERDICT_ORDER.map((k) => ({ k, n: rows.filter((r) => r.verdict === k).length }));

  return (
    <div className="mx-auto max-w-7xl px-5 pt-14">
      <Reveal>
        <div className="font-mono text-xs tracking-[0.3em] text-bnb">PUBLIC LEDGER</div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">Every receipt, forever.</h1>
          <a
            href={`https://testnet.bscscan.com/address/${REGISTRY}#events`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost px-4 py-2 font-mono text-xs text-white/60"
          >
            {totals.receipts} receipts · read raw events on BscScan ↗
          </a>
        </div>
        <p className="mt-4 max-w-2xl text-white/55">
          Read straight from the RECEIPTS Diamond on BNB Chain. Nothing here can be edited or deleted, not even by us.
        </p>
      </Reveal>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/ledger" className={`rounded-full px-4 py-2 text-sm ${!filter ? "bg-white text-ink" : "btn-ghost text-white/70"}`}>
          All <span className="opacity-60">{rows.length}</span>
        </Link>
        <Link
          href={sourcedOnly ? "/ledger" : "/ledger?src=1"}
          className={`rounded-full px-4 py-2 text-sm ${sourcedOnly ? "bg-[#5ac8fa] text-ink" : "btn-ghost text-white/70"}`}
        >
          ● With original post <span className="opacity-60">{sourcedCount}</span>
        </Link>
        {counts.map(({ k, n }) => (
          <Link
            key={k}
            href={`/ledger?v=${k}`}
            className={`rounded-full px-4 py-2 text-sm transition ${filter === k ? "text-ink" : "btn-ghost text-white/70"}`}
            style={filter === k ? { background: VERDICTS[k].color } : undefined}
          >
            {VERDICTS[k].label} <span className="opacity-60">{n}</span>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        {shown.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((r, i) => (
              <Reveal key={r.id} delay={Math.min(i, 8) * 0.04}>
                <ReceiptCard r={r} />
              </Reveal>
            ))}
          </div>
        ) : (
          <EmptyLedger />
        )}
      </div>

      {(page > 0 || rows.length === PER) && (
        <div className="mt-10 flex justify-center gap-3">
          {page > 0 && (
            <Link href={`/ledger?page=${page - 1}${filter ? `&v=${filter}` : ""}`} className="btn-ghost px-5 py-2 text-sm">
              ← Newer
            </Link>
          )}
          {rows.length === PER && (
            <Link href={`/ledger?page=${page + 1}${filter ? `&v=${filter}` : ""}`} className="btn-ghost px-5 py-2 text-sm">
              Older →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
