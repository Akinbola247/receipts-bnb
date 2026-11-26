import Link from "next/link";
import { Logo } from "./Logo";
import { REGISTRY_ADDRESS } from "@/lib/config";

export function Footer() {
  const reg = REGISTRY_ADDRESS;
  return (
    <footer className="relative mt-32 border-t border-line/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-mono font-bold tracking-[0.25em]">RECEIPTS</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/50">
            A public, tamper-proof ledger of crypto price calls. Market odds from the Cournot Intelligence Oracle, market data from
            CoinMarketCap, receipts on BNB Chain.
          </p>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-white/35">
            An assessment of prediction-market pricing. Not investment advice.
          </p>
        </div>
        <div className="text-sm">
          <div className="mb-3 font-mono text-[11px] tracking-widest text-white/40">PRODUCT</div>
          <ul className="space-y-2 text-white/70">
            <li><Link className="hover:text-white" href="/check">Check a call</Link></li>
            <li><Link className="hover:text-white" href="/ledger">Public ledger</Link></li>
            <li><Link className="hover:text-white" href="/hall">Hall of Hype</Link></li>
            <li><Link className="hover:text-white" href="/how">How it works &amp; verify</Link></li>
            <li><Link className="hover:text-white" href="/explorer">On-chain explorer</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="mb-3 font-mono text-[11px] tracking-widest text-white/40">ON-CHAIN</div>
          <ul className="space-y-2 text-white/70">
            {reg && (
              <li>
                <a className="font-mono text-xs hover:text-bnb" target="_blank" rel="noreferrer" href={`https://testnet.bscscan.com/address/${reg}`}>
                  Registry {reg.slice(0, 8)}…{reg.slice(-6)} ↗
                </a>
              </li>
            )}
            <li><a className="hover:text-white" target="_blank" rel="noreferrer" href="https://cournot.ai">Cournot Intelligence ↗</a></li>
            <li><a className="hover:text-white" target="_blank" rel="noreferrer" href="https://coinmarketcap.com/api/">CoinMarketCap API ↗</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line/50 py-5 text-center font-mono text-[11px] tracking-widest text-white/30">
        BUILT AT BNB BANGKOK · 2026 · THANK YOU, COME AGAIN
      </div>
    </footer>
  );
}
