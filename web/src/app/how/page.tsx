import { Fragment } from "react";
import { toFunctionSelector, type AbiFunction } from "viem";
import { registryAbi } from "@/lib/abi";
import { EXPLORER, getFacets, REGISTRY, type FacetInfo } from "@/lib/chain";
import { Reveal } from "@/components/Motion";
import { short } from "@/lib/format";

export const revalidate = 300;
export const metadata = { title: "How it works — RECEIPTS" };

const SEL_NAME = new Map<string, string>();
for (const f of registryAbi.filter((x) => x.type === "function") as unknown as AbiFunction[]) {
  SEL_NAME.set(toFunctionSelector(f).toLowerCase(), f.name);
}

const FACET_BY_FN: Record<string, { name: string; role: string }> = {
  diamondCut: { name: "DiamondCutFacet", role: "Owner-gated upgrades (add / replace / remove)" },
  facets: { name: "DiamondLoupeFacet", role: "Introspection: what's routed where (EIP-2535 + ERC-165)" },
  owner: { name: "OwnershipFacet", role: "ERC-173 ownership" },
  anchor: { name: "ReceiptFacet", role: "Write path: attester anchor, batch, EIP-712 permissionless anchorWithSig" },
  settle: { name: "SettlementFacet", role: "Resolve markets, update caller alpha" },
  latest: { name: "LedgerFacet", role: "Read path: pages, callers, markets, evidence verification" },
  setAttester: { name: "AdminFacet", role: "Attester registry, circuit breaker, EIP-712 domain" },
};

function label(f: FacetInfo) {
  const names = f.selectors.map((s) => SEL_NAME.get(s.toLowerCase()) ?? s);
  const key = names.find((n) => FACET_BY_FN[n]);
  return { meta: key ? FACET_BY_FN[key] : { name: "Facet", role: "" }, names };
}

export default async function HowPage() {
  const facets = await getFacets().catch(() => [] as FacetInfo[]);

  return (
    <div className="mx-auto max-w-7xl px-5 pt-14">
      <Reveal>
        <div className="font-mono text-xs tracking-[0.3em] text-bnb">HOW IT WORKS</div>
        <h1 className="mt-3 max-w-4xl text-4xl font-extrabold tracking-tight md:text-6xl">Built so nobody has to trust us.</h1>
        <p className="mt-4 max-w-2xl text-white/55">
          Three independent sources, one upgradeable on-chain ledger, and a cost model where nobody, including us, pays to keep it running.
        </p>
      </Reveal>

      {/* flow */}
      <Reveal>
        <div className="card mt-12 overflow-x-auto p-6 md:p-10">
          <div className="grid min-w-[760px] grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch gap-3">
            {[
              { t: "Browser", s: ["Paste call + @handle", "Calls Cournot directly", "(own free quota, CORS)"] },
              { t: "Cournot Oracle", s: ["/resolve → market id", "/probability → p + basis", "Kalshi · Binance · venues"] },
              { t: "RECEIPTS API", s: ["Validates response", "Re-verifies market (free)", "CoinMarketCap snapshot"] },
              { t: "BNB Chain Diamond", s: ["ReceiptFacet.anchor", "evidence JSON in event log", "keccak256 stored in state"] },
            ].map((b, i, arr) => (
              <Fragment key={b.t}>
                <div className="rounded-2xl border border-line bg-ink p-5">
                  <div className="font-mono text-[10px] tracking-widest text-bnb">0{i + 1}</div>
                  <div className="mt-2 font-bold">{b.t}</div>
                  <ul className="mt-3 space-y-1 font-mono text-[11px] text-white/50">
                    {b.s.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex items-center text-2xl text-bnb">
                    →
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </Reveal>

      {/* principles */}
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {[
          {
            t: "Zero-cost by design",
            d: "Cournot is called from each visitor's browser, so everyone uses their own free quota. Results anchored in the last 6h are reused from the chain: the ledger is the cache. Gas on BSC is ~0.1 gwei and sponsored.",
          },
          {
            t: "Tamper-evident",
            d: "The full Cournot response is emitted in the anchoring transaction and its keccak256 is stored on-chain. Any change to a single byte breaks verification, which you can run in your browser on every receipt page.",
          },
          {
            t: "Permissionless",
            d: "Receipts can be submitted by anyone through anchorWithSig: an attester signs an EIP-712 payload off-chain, and any wallet can land it. Nonces stop replays, deadlines stop stale data, and high-s signatures are rejected.",
          },
        ].map((x, i) => (
          <Reveal key={x.t} delay={i * 0.06}>
            <div className="card h-full p-7">
              <div className="text-xl font-bold">{x.t}</div>
              <p className="mt-3 text-sm leading-relaxed text-white/55">{x.d}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {/* diamond */}
      <Reveal>
        <div className="mt-20 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs tracking-[0.3em] text-bnb">ARCHITECTURE · EIP-2535 DIAMOND</div>
            <h2 className="mt-3 text-3xl font-bold md:text-5xl">One permanent address. Upgradeable facets.</h2>
            <p className="mt-3 max-w-2xl text-white/55">
              All state lives in namespaced diamond storage (<code className="font-mono text-white/75">keccak256(&quot;receipts.ledger.storage.v1&quot;)</code>), so
              facets can be swapped without migrating a single receipt. The table below is read <em>live</em> from the diamond&apos;s loupe.
            </p>
          </div>
          <a href={`${EXPLORER}/address/${REGISTRY}`} target="_blank" rel="noreferrer" className="btn-ghost px-4 py-2 font-mono text-xs text-white/65">
            Diamond {short(REGISTRY, 8, 6)} ↗
          </a>
        </div>
      </Reveal>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {facets.length ? (
          facets.map((f, i) => {
            const { meta, names } = label(f);
            return (
              <Reveal key={f.address} delay={i * 0.04}>
                <div className="card h-full p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 rotate-45 place-items-center rounded-md border border-bnb/50 bg-bnb/10">
                        <span className="-rotate-45 font-mono text-[11px] font-bold text-bnb">{names.length}</span>
                      </span>
                      <div>
                        <div className="font-bold">{meta.name}</div>
                        <div className="text-xs text-white/45">{meta.role}</div>
                      </div>
                    </div>
                    <a href={`${EXPLORER}/address/${f.address}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-white/40 hover:text-bnb">
                      {short(f.address)} ↗
                    </a>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {names.map((n) => (
                      <span key={n} className="rounded-md bg-white/[0.04] px-2 py-1 font-mono text-[10.5px] text-white/60">
                        {n}()
                      </span>
                    ))}
                  </div>
                </div>
              </Reveal>
            );
          })
        ) : (
          <div className="text-white/45">Diamond not deployed yet.</div>
        )}
      </div>

      {/* rules */}
      <Reveal>
        <div className="mt-20 grid gap-5 md:grid-cols-2">
          <div className="card p-7">
            <div className="font-mono text-xs tracking-[0.3em] text-bnb">VERDICT RULE · ON-CHAIN</div>
            <div className="mt-5 space-y-3 font-mono text-sm">
              {[
                ["p ≥ 65%", "LIKELY", "#2bd67b"],
                ["35% ≤ p < 65%", "COIN FLIP", "#f0b90b"],
                ["10% ≤ p < 35%", "UNLIKELY", "#ff8a3d"],
                ["p < 10%", "DELUSIONAL", "#ff3b5c"],
              ].map(([a, b, c]) => (
                <div key={b} className="flex justify-between border-b border-line/60 pb-2">
                  <span className="text-white/60">{a}</span>
                  <span style={{ color: c }}>{b}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-white/40">
              Implemented in <code>LibReceipts.verdictFor</code>. Callers can&apos;t be re-labelled after the fact.
            </p>
          </div>
          <div className="card p-7">
            <div className="font-mono text-xs tracking-[0.3em] text-bnb">ALPHA SCORE · ON-CHAIN</div>
            <div className="mt-5 space-y-3 font-mono text-sm text-white/70">
              <div>HIT &nbsp;→ alpha += (10000 − p)</div>
              <div>MISS → alpha −= p</div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/55">
              A caller who just repeats market consensus converges to zero. Only people who are right when the market thinks they&apos;re
              wrong build positive alpha. It&apos;s a reputation you can&apos;t buy, fake, or delete. Settled via{" "}
              <code className="font-mono">SettlementFacet.settleMarket</code> once the Cournot market resolves.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="card mt-5 p-7">
          <div className="font-mono text-xs tracking-[0.3em] text-bnb">DATA SOURCES</div>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div>
              <div className="font-bold">Cournot Intelligence Oracle</div>
              <p className="mt-2 text-sm text-white/55">
                <code className="font-mono">POST /intelligence/v1/resolve</code> matches the free-text call to live markets.{" "}
                <code className="font-mono">POST /intelligence/v1/probability</code> returns the probability, the evaluated market, and its basis
                (Kalshi prices, Binance futures, cross-venue data, model forecasts). The probability drives the on-chain verdict.
              </p>
            </div>
            <div>
              <div className="font-bold">CoinMarketCap Pro API</div>
              <p className="mt-2 text-sm text-white/55">
                <code className="font-mono">/v2/cryptocurrency/quotes/latest</code>, <code className="font-mono">/v3/fear-and-greed/latest</code> and{" "}
                <code className="font-mono">/v1/global-metrics/quotes/latest</code>. Spot price and Fear &amp; Greed are written into every
                receipt; momentum and volatility drive the position-sizing guidance. The key stays server-side and responses are cached.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
