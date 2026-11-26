"use client";

import { motion, type Variants } from "motion/react";
import { VERDICTS, type VerdictKey } from "@/lib/verdict";
import { pct, receiptNo, short, signed, stamp, usd } from "@/lib/format";

export type SlipData = {
  id?: number | null;
  claim: string;
  caller: string;
  asset: string;
  probabilityBps: number;
  verdict: VerdictKey;
  marketId: number;
  marketTitle?: string;
  resolvesAt: number;
  spotPrice: number;
  change24h?: number;
  fearGreed: number;
  createdAt: number;
  evidenceHash?: string;
  txHash?: string;
  outcome?: "PENDING" | "HIT" | "MISS";
  pending?: boolean;
};

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};
const line: Variants = {
  hidden: { opacity: 0, y: -6, filter: "blur(3px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.28 } },
};

export function Barcode({ seed, className = "" }: { seed: string; className?: string }) {
  const hex = (seed || "0x").replace(/^0x/, "").padEnd(64, "a").slice(0, 64);
  let x = 0;
  const bars: { x: number; w: number }[] = [];
  for (const ch of hex) {
    const v = parseInt(ch, 16);
    const w = 1 + (v % 3);
    bars.push({ x, w });
    x += w + 1 + ((v >> 2) % 2);
  }
  return (
    <svg viewBox={`0 0 ${x} 40`} preserveAspectRatio="none" className={className} aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={40} fill="currentColor" />
      ))}
    </svg>
  );
}

export function Stamp({ verdict, animate = true, className = "" }: { verdict: VerdictKey; animate?: boolean; className?: string }) {
  const v = VERDICTS[verdict];
  return (
    <motion.div
      initial={animate ? { scale: 2.6, opacity: 0, rotate: -24 } : false}
      animate={{ scale: 1, opacity: 0.92, rotate: -11 }}
      transition={{ type: "spring", stiffness: 520, damping: 18, mass: 1.1, delay: animate ? 0.9 : 0 }}
      className={`stamp pointer-events-none select-none text-2xl sm:text-3xl ${className}`}
      style={{ color: v.ink }}
    >
      {v.label}
    </motion.div>
  );
}

export function ReceiptSlip({ data, print = false, compact = false }: { data: SlipData; print?: boolean; compact?: boolean }) {
  const v = VERDICTS[data.verdict];
  const Row = ({ k, val, strong = false }: { k: string; val: React.ReactNode; strong?: boolean }) => (
    <motion.div variants={line} className={`leader text-[12.5px] ${strong ? "font-bold" : ""}`}>
      <span className="uppercase tracking-wide text-paper-ink/70">{k}</span>
      <span className="text-right">{val}</span>
    </motion.div>
  );

  return (
    <div className="paper-shadow">
      <motion.div
        initial={print ? { clipPath: "inset(0 0 100% 0)" } : false}
        animate={{ clipPath: "inset(0 0 0% 0)" }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className={`paper relative font-mono ${compact ? "px-5 pb-7 pt-7" : "px-6 pb-9 pt-9 sm:px-8"}`}
      >
        <motion.div variants={container} initial={print ? "hidden" : false} animate="show" className="space-y-2.5">
          <motion.div variants={line} className="text-center">
            <div className="text-[11px] tracking-[0.4em] text-paper-ink/60">★ RECEIPTS ★</div>
            <div className="mt-1 text-[10.5px] tracking-widest text-paper-ink/50">
              PROOF OF CALL · BNB CHAIN
            </div>
          </motion.div>
          <motion.div variants={line} className="flex justify-between text-[11px] text-paper-ink/60">
            <span>{data.id != null ? `RCPT ${receiptNo(data.id)}` : data.pending ? "RCPT PRINTING…" : "RCPT DRAFT"}</span>
            <span>{stamp(data.createdAt)}</span>
          </motion.div>
          <motion.div variants={line} className="dash" />

          <motion.div variants={line}>
            <div className="text-[10.5px] uppercase tracking-widest text-paper-ink/55">Claim by {data.caller}</div>
            <div className={`mt-1.5 font-sans font-semibold leading-snug ${compact ? "text-[15px]" : "text-[19px]"}`}>
              &ldquo;{data.claim}&rdquo;
            </div>
          </motion.div>

          {data.marketTitle && !compact && (
            <motion.div variants={line} className="rounded-md bg-paper-ink/[0.06] px-3 py-2 text-[11.5px] leading-snug">
              <span className="text-paper-ink/55">MATCHED MARKET #{data.marketId} · </span>
              {data.marketTitle}
            </motion.div>
          )}
          <motion.div variants={line} className="dash" />

          <Row k="Asset" val={data.asset} />
          <Row k="Spot (CMC)" val={usd(data.spotPrice)} />
          {data.change24h !== undefined && <Row k="24h change" val={signed(data.change24h)} />}
          <Row k="Fear & Greed" val={`${data.fearGreed}/100`} />
          {!compact && <Row k="Resolves" val={data.resolvesAt ? stamp(data.resolvesAt) : "—"} />}
          <motion.div variants={line} className="dash" />

          <motion.div variants={line} className="flex items-end justify-between">
            <span className="text-[12px] uppercase tracking-widest text-paper-ink/70">Market odds</span>
            <span className={`font-sans font-extrabold leading-none ${compact ? "text-4xl" : "text-6xl"}`} style={{ color: v.ink }}>
              {pct(data.probabilityBps)}
            </span>
          </motion.div>
          <motion.div variants={line} className="h-2 overflow-hidden rounded-full bg-paper-ink/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: v.ink }}
              initial={print ? { width: 0 } : false}
              animate={{ width: `${Math.max(2, data.probabilityBps / 100)}%` }}
              transition={{ duration: 1.2, delay: print ? 0.8 : 0, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
          <motion.div variants={line} className="text-[12px] leading-snug">
            <span className="font-bold">ACTION · </span>
            {v.action}
          </motion.div>

          {data.outcome && data.outcome !== "PENDING" && (
            <Row k="Outcome" val={data.outcome === "HIT" ? "✔ HIT" : "✘ MISS"} strong />
          )}
          <motion.div variants={line} className="dash" />

          <motion.div variants={line} className="pt-1 text-paper-ink">
            <Barcode seed={data.evidenceHash || data.txHash || data.claim} className="h-10 w-full" />
            <div className="mt-1.5 flex justify-between text-[10px] text-paper-ink/55">
              <span>EVIDENCE {data.evidenceHash ? short(data.evidenceHash, 8, 6) : "—"}</span>
              <span>{data.txHash ? `TX ${short(data.txHash, 6, 4)}` : "NOT YET ANCHORED"}</span>
            </div>
          </motion.div>
          {!compact && (
            <motion.div variants={line} className="pt-1 text-center text-[10.5px] tracking-widest text-paper-ink/50">
              ODDS: COURNOT INTELLIGENCE · DATA: COINMARKETCAP
              <br />
              THANK YOU · DYOR · NOT FINANCIAL ADVICE
            </motion.div>
          )}
        </motion.div>

        <div className={`absolute ${compact ? "right-3 top-[38%]" : "right-4 top-[40%] sm:right-6"}`}>
          <Stamp verdict={data.verdict} animate={print} className={compact ? "!text-lg" : ""} />
        </div>
      </motion.div>
    </div>
  );
}
