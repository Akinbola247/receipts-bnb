import Link from "next/link";
import { getCallers, type CallerView } from "@/lib/chain";
import { Reveal } from "@/components/Motion";
import { pct } from "@/lib/format";
import { VERDICTS, verdictFor } from "@/lib/verdict";

export const revalidate = 15;
export const metadata = { title: "Hall of Hype — RECEIPTS" };

export default async function HallPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const sp = await searchParams;
  const sort = sp.sort === "alpha" ? "alpha" : sp.sort === "calls" ? "calls" : "hype";
  const callers = await getCallers().catch(() => [] as CallerView[]);
  const sorted = [...callers].sort((a, b) =>
    sort === "alpha" ? b.alphaBps - a.alphaBps : sort === "calls" ? b.calls - a.calls : a.avgBps - b.avgBps || b.calls - a.calls,
  );
  const top3 = sorted.slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-5 pt-14">
      <Reveal>
        <div className="font-mono text-xs tracking-[0.3em] text-bnb">HALL OF HYPE</div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-6xl">Who&apos;s selling hopium?</h1>
        <p className="mt-4 max-w-2xl text-white/55">
          Every caller with a receipt, ranked by the market odds of what they call. Once markets resolve, the on-chain{" "}
          <span className="text-white">alpha score</span> shows who actually beats the market: a hit on a 4% call earns +96, and a miss on
          an 80% call costs −80.
        </p>
      </Reveal>

      <div className="mt-8 flex gap-2">
        {[
          { k: "hype", l: "Most delusional" },
          { k: "alpha", l: "Highest alpha" },
          { k: "calls", l: "Most calls" },
        ].map((x) => (
          <Link key={x.k} href={`/hall?sort=${x.k}`} className={`rounded-full px-4 py-2 text-sm ${sort === x.k ? "bg-white text-ink" : "btn-ghost text-white/70"}`}>
            {x.l}
          </Link>
        ))}
      </div>

      {top3.length > 0 && (
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {top3.map((c, i) => {
            const v = VERDICTS[verdictFor(Math.round(c.avgBps))];
            return (
              <Reveal key={c.hash} delay={i * 0.08}>
                <Link href={`/caller/${encodeURIComponent(c.handle)}`} className="card group relative block overflow-hidden p-7 transition hover:-translate-y-1">
                  <div className="absolute -right-6 -top-10 font-mono text-[140px] font-black leading-none text-white/[0.04]">{i + 1}</div>
                  <div className="font-mono text-xs text-white/40">#{i + 1}</div>
                  <div className="mt-3 truncate font-mono text-2xl font-bold text-bnb">{c.handle}</div>
                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <div className="text-5xl font-extrabold" style={{ color: v.color }}>
                        {pct(c.avgBps)}
                      </div>
                      <div className="mt-1 font-mono text-[10.5px] text-white/40">AVG MARKET ODDS</div>
                    </div>
                    <div className="text-right font-mono text-xs text-white/55">
                      <div>{c.calls} calls</div>
                      <div>
                        {c.hits}H / {c.misses}M
                      </div>
                      <div className={c.alphaBps >= 0 ? "text-good" : "text-bad"}>α {(c.alphaBps / 100).toFixed(0)}</div>
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}

      <Reveal>
        <div className="card mt-8 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-5 py-4">#</th>
                <th className="px-5 py-4">Caller</th>
                <th className="px-5 py-4">Calls</th>
                <th className="px-5 py-4">Avg odds</th>
                <th className="hidden px-5 py-4 sm:table-cell">Hit / Miss</th>
                <th className="px-5 py-4 text-right">Alpha</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => {
                const v = VERDICTS[verdictFor(Math.round(c.avgBps))];
                return (
                  <tr key={c.hash} className="border-b border-line/50 transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4 font-mono text-white/40">{i + 1}</td>
                    <td className="px-5 py-4">
                      <Link href={`/caller/${encodeURIComponent(c.handle)}`} className="font-mono text-bnb hover:underline">
                        {c.handle}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-mono">{c.calls}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(3, c.avgBps / 100)}%`, background: v.color }} />
                        </div>
                        <span className="font-mono" style={{ color: v.color }}>
                          {pct(c.avgBps)}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-5 py-4 font-mono text-white/60 sm:table-cell">
                      {c.hits} / {c.misses}
                    </td>
                    <td className={`px-5 py-4 text-right font-mono ${c.alphaBps > 0 ? "text-good" : c.alphaBps < 0 ? "text-bad" : "text-white/40"}`}>
                      {c.alphaBps > 0 ? "+" : ""}
                      {(c.alphaBps / 100).toFixed(1)}
                    </td>
                  </tr>
                );
              })}
              {!sorted.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-white/45">
                    No callers on the record yet.{" "}
                    <Link className="text-bnb underline" href="/check">
                      Put the first one on it.
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  );
}
