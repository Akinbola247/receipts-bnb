import Link from "next/link";
import { formatEther } from "viem";
import { getActivity, getBlockTimes, type ActivityEvent } from "@/lib/explorer";
import { EXPLORER, getFacets, getTotals, publicClient, REGISTRY } from "@/lib/chain";
import { Reveal } from "@/components/Motion";
import { ago, pct, short } from "@/lib/format";
import { VERDICTS, verdictFromIndex } from "@/lib/verdict";

export const revalidate = 10;
export const metadata = { title: "Explorer — RECEIPTS" };

const EVENT_STYLE: Record<string, { color: string; label: string }> = {
  ReceiptAnchored: { color: "#f0b90b", label: "RECEIPT ANCHORED" },
  SourceLinked: { color: "#5ac8fa", label: "SOURCE LINKED" },
  ReceiptSettled: { color: "#2bd67b", label: "RECEIPT SETTLED" },
  DiamondCut: { color: "#b18cff", label: "DIAMOND CUT" },
  AttesterSet: { color: "#ff8a3d", label: "ATTESTER SET" },
  OwnershipTransferred: { color: "#8b8b96", label: "OWNERSHIP" },
  PausedSet: { color: "#ff3b5c", label: "PAUSE" },
};

const ACTIONS = ["Add", "Replace", "Remove"];

/* eslint-disable @typescript-eslint/no-explicit-any */
function summary(e: ActivityEvent): React.ReactNode {
  const a = e.args as any;
  switch (e.name) {
    case "ReceiptAnchored": {
      const v = VERDICTS[verdictFromIndex(Number(a.verdict))];
      return (
        <>
          <Link href={`/r/${a.id}`} className="font-mono text-bnb hover:underline">#{String(a.id)}</Link>{" "}
          <span className="font-mono text-white/70">{a.caller}</span> <span className="text-white/80">&ldquo;{a.claim}&rdquo;</span>{" "}
          <span className="font-mono font-bold" style={{ color: v.color }}>
            → {pct(Number(a.probabilityBps))} {v.label}
          </span>
        </>
      );
    }
    case "SourceLinked":
      return (
        <>
          <Link href={`/r/${a.id}`} className="font-mono text-bnb hover:underline">#{String(a.id)}</Link> ←{" "}
          <a href={a.url} target="_blank" rel="noreferrer nofollow" className="break-all text-white/70 hover:text-white">
            {a.url}
          </a>
        </>
      );
    case "ReceiptSettled":
      return (
        <>
          <Link href={`/r/${a.id}`} className="font-mono text-bnb hover:underline">#{String(a.id)}</Link> settled{" "}
          <b>{Number(a.outcome) === 1 ? "HIT" : "MISS"}</b> · alpha {Number(a.alphaDelta) > 0 ? "+" : ""}
          {(Number(a.alphaDelta) / 100).toFixed(1)}
        </>
      );
    case "DiamondCut":
      return (
        <span className="text-white/75">
          {(a._diamondCut as any[]).map((c, i) => (
            <span key={i} className="mr-3 inline-block">
              <b>{ACTIONS[Number(c.action)]}</b> {c.functionSelectors.length} selectors →{" "}
              <a className="font-mono text-white/60 hover:text-bnb" target="_blank" rel="noreferrer" href={`${EXPLORER}/address/${c.facetAddress}`}>
                {short(c.facetAddress)}
              </a>
            </span>
          ))}
          {a._init !== "0x0000000000000000000000000000000000000000" && <span className="text-white/45">+ init {short(a._init)}</span>}
        </span>
      );
    case "AttesterSet":
      return (
        <span className="font-mono text-white/70">
          {short(a.attester)} {a.allowed ? "authorised" : "revoked"}
        </span>
      );
    case "OwnershipTransferred":
      return (
        <span className="font-mono text-white/70">
          {short(a.previousOwner)} → {short(a.newOwner)}
        </span>
      );
    default:
      return <span className="text-white/50">{e.name}</span>;
  }
}

export default async function ExplorerPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  const [{ events, head }, totals, facets, owner] = await Promise.all([
    getActivity().catch(() => ({ events: [] as ActivityEvent[], head: 0 })),
    getTotals().catch(() => ({ receipts: 0, callers: 0 })),
    getFacets().catch(() => []),
    publicClient.readContract({ address: REGISTRY, abi: (await import("@/lib/abi")).registryAbi, functionName: "owner" }).catch(() => null),
  ]);
  const relayerBal = owner ? await publicClient.getBalance({ address: owner as `0x${string}` }).catch(() => 0n) : 0n;
  const filter = sp.e && EVENT_STYLE[sp.e] ? sp.e : null;
  const shown = (filter ? events.filter((x) => x.name === filter) : events).slice(0, 80);
  const times = await getBlockTimes(shown.map((x) => x.blockNumber));
  const counts = Object.keys(EVENT_STYLE).map((k) => ({ k, n: events.filter((x) => x.name === k).length })).filter((x) => x.n);
  const cuts = events.filter((x) => x.name === "DiamondCut").reverse();
  const txs = new Set(events.map((x) => x.txHash)).size;

  return (
    <div className="mx-auto max-w-7xl px-5 pt-14">
      <Reveal>
        <div className="font-mono text-xs tracking-[0.3em] text-bnb">ON-CHAIN EXPLORER</div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-6xl">Every interaction, decoded.</h1>
        <p className="mt-4 max-w-2xl text-white/55">
          A live, decoded view of every event the RECEIPTS Diamond has emitted on BNB Smart Chain testnet: receipts, provenance links,
          settlements and facet upgrades. Read straight from the chain, with nothing indexed by us.
        </p>
      </Reveal>

      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          ["Diamond", <a key="d" className="hover:text-bnb" target="_blank" rel="noreferrer" href={`${EXPLORER}/address/${REGISTRY}`}>{short(REGISTRY, 6, 4)} ↗</a>],
          ["Head block", head.toLocaleString()],
          ["Events", events.length],
          ["Transactions", txs],
          ["Receipts", totals.receipts],
          ["Facets", facets.length],
        ].map(([k, v]) => (
          <div key={String(k)} className="card p-4">
            <div className="font-mono text-[10.5px] uppercase text-white/40">{k}</div>
            <div className="mt-1.5 truncate font-mono text-lg font-bold">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex flex-wrap gap-2">
            <Link href="/explorer" className={`rounded-full px-3.5 py-1.5 text-xs ${!filter ? "bg-white text-ink" : "btn-ghost text-white/70"}`}>
              All {events.length}
            </Link>
            {counts.map(({ k, n }) => (
              <Link
                key={k}
                href={`/explorer?e=${k}`}
                className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] ${filter === k ? "text-ink" : "btn-ghost text-white/70"}`}
                style={filter === k ? { background: EVENT_STYLE[k].color } : undefined}
              >
                {EVENT_STYLE[k].label} {n}
              </Link>
            ))}
          </div>

          <div className="card mt-4 overflow-hidden">
            <div className="hidden grid-cols-[110px_150px_1fr_120px] gap-4 border-b border-line px-5 py-3 font-mono text-[10.5px] uppercase tracking-wider text-white/40 md:grid">
              <span>Block</span>
              <span>Event</span>
              <span>Decoded</span>
              <span className="text-right">Tx</span>
            </div>
            {shown.map((e) => {
              const st = EVENT_STYLE[e.name] ?? { color: "#888", label: e.name };
              return (
                <div
                  key={`${e.txHash}-${e.logIndex}`}
                  className="grid gap-2 border-b border-line/50 px-5 py-3.5 text-sm transition hover:bg-white/[0.025] md:grid-cols-[110px_150px_1fr_120px] md:gap-4"
                >
                  <div className="font-mono text-xs">
                    <div className="text-white/75">{e.blockNumber.toLocaleString()}</div>
                    <div className="text-white/35">{times[e.blockNumber] ? ago(times[e.blockNumber]) : ""}</div>
                  </div>
                  <div>
                    <span
                      className="inline-block rounded-md px-2 py-1 font-mono text-[10px] font-bold tracking-wider"
                      style={{ color: st.color, background: `${st.color}18`, boxShadow: `inset 0 0 0 1px ${st.color}40` }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <div className="min-w-0 leading-relaxed">{summary(e)}</div>
                  <div className="font-mono text-xs md:text-right">
                    <Link href={`/explorer/tx/${e.txHash}`} className="text-bnb hover:underline">
                      {short(e.txHash, 6, 4)}
                    </Link>
                  </div>
                </div>
              );
            })}
            {!shown.length && <div className="p-10 text-center text-white/45">No events found.</div>}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="card p-5">
            <div className="font-mono text-[11px] tracking-widest text-white/40">DIAMOND UPGRADE HISTORY</div>
            <ol className="relative mt-4 space-y-5 border-l border-line pl-5">
              {cuts.map((c, i) => {
                const list = (c.args as any)._diamondCut as any[];
                return (
                  <li key={c.txHash}>
                    <span className="absolute -left-[7px] mt-1 h-3 w-3 rotate-45 rounded-[2px] border border-[#b18cff] bg-ink" />
                    <div className="font-mono text-xs text-white/45">
                      {i === 0 ? "GENESIS" : `UPGRADE ${i}`} · block {c.blockNumber.toLocaleString()}
                    </div>
                    <div className="mt-1 text-sm text-white/80">
                      {list.length} facet{list.length > 1 ? "s" : ""} · {list.reduce((n, x) => n + x.functionSelectors.length, 0)} selectors
                    </div>
                    <Link href={`/explorer/tx/${c.txHash}`} className="font-mono text-[11px] text-bnb hover:underline">
                      {short(c.txHash, 8, 6)}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="card p-5">
            <div className="font-mono text-[11px] tracking-widest text-white/40">GAS SPONSOR (RELAYER)</div>
            <div className="mt-2 break-all font-mono text-xs text-white/70">{owner ? String(owner) : "—"}</div>
            <div className="mt-3 text-2xl font-bold">{Number(formatEther(relayerBal)).toFixed(4)} tBNB</div>
            <p className="mt-2 text-xs text-white/45">Pays gas so nobody needs a wallet. At ~0.1 gwei a receipt costs about 0.00004 tBNB.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
