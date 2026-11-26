import Link from "next/link";
import { notFound } from "next/navigation";
import { formatEther, formatGwei, type Hex } from "viem";
import { getTx } from "@/lib/explorer";
import { EXPLORER } from "@/lib/chain";
import { Reveal } from "@/components/Motion";
import { stamp } from "@/lib/format";

export const revalidate = 3600;

function pretty(v: unknown): string {
  return JSON.stringify(
    v,
    (_k, x) => {
      if (typeof x === "bigint") return x.toString();
      if (typeof x === "string" && x.length > 400) return `${x.slice(0, 400)}… (${x.length} bytes, full copy in the event log)`;
      return x;
    },
    2,
  );
}

export default async function TxPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) notFound();
  const tx = await getTx(hash as Hex);
  if (!tx) notFound();
  const receiptId = tx.events.find((e) => e.name === "ReceiptAnchored")?.args?.id as bigint | undefined;

  return (
    <div className="mx-auto max-w-5xl px-5 pt-14">
      <Link href="/explorer" className="font-mono text-xs text-white/45 hover:text-white">
        ← EXPLORER
      </Link>
      <Reveal>
        <div className="mt-6 font-mono text-xs tracking-[0.3em] text-bnb">TRANSACTION</div>
        <h1 className="mt-3 break-all font-mono text-xl font-bold md:text-2xl">{tx.hash}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${tx.status === "success" ? "bg-good/15 text-good" : "bg-bad/15 text-bad"}`}>
            {tx.status === "success" ? "✔ SUCCESS" : "✘ REVERTED"}
          </span>
          <span className="rounded-full bg-bnb/15 px-3 py-1 font-mono text-xs font-bold text-bnb">{tx.method}()</span>
          {receiptId !== undefined && (
            <Link href={`/r/${receiptId}`} className="btn-bnb px-3 py-1 text-xs">
              Receipt #{String(receiptId)} →
            </Link>
          )}
          <a href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1 font-mono text-xs text-white/60">
            BscScan ↗
          </a>
        </div>
      </Reveal>

      <Reveal>
        <div className="card mt-8 divide-y divide-line/60 font-mono text-sm">
          {[
            ["Block", tx.blockNumber.toLocaleString()],
            ["Time", stamp(tx.timestamp)],
            ["From", tx.from],
            ["To", tx.to ?? "contract creation"],
            ["Gas used", tx.gasUsed.toLocaleString()],
            ["Gas price", `${formatGwei(tx.gasPrice)} gwei`],
            ["Fee", `${formatEther(tx.fee)} tBNB`],
            ["Calldata", `${tx.inputBytes.toLocaleString()} bytes`],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-6">
              <span className="w-28 shrink-0 text-white/40">{k}</span>
              <span className="break-all text-white/85">{v}</span>
            </div>
          ))}
        </div>
      </Reveal>

      {tx.args != null && (
        <Reveal>
          <section className="card mt-6 p-5">
            <div className="font-mono text-[11px] tracking-widest text-white/40">DECODED INPUT · {tx.method}</div>
            <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-all text-[11.5px] leading-relaxed text-white/70">{pretty(tx.args)}</pre>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section className="card mt-6 p-5">
          <div className="font-mono text-[11px] tracking-widest text-white/40">DIAMOND EVENTS ({tx.events.length})</div>
          <div className="mt-3 space-y-3">
            {tx.events.map((e) => (
              <div key={e.logIndex} className="rounded-xl border border-line p-4">
                <div className="font-mono text-sm font-bold text-bnb">{e.name}</div>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11px] text-white/60">{pretty(e.args)}</pre>
              </div>
            ))}
            {!tx.events.length && <div className="text-sm text-white/45">This transaction emitted no RECEIPTS events (e.g. a facet deployment).</div>}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
