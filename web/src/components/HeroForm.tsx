"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const ROTATING = ["BNB to $1,000 by January", "Bitcoin $150k before 2027", "ETH flips $5,000 this month", "SOL will hit $300 this year"];

export function HeroForm() {
  const r = useRouter();
  const [claim, setClaim] = useState("");
  const [by, setBy] = useState("");
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % ROTATING.length), 2600);
    return () => clearInterval(t);
  }, []);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    q.set("q", claim || ROTATING[i]);
    if (by) q.set("by", by);
    r.push(`/check?${q.toString()}`);
  };

  return (
    <form onSubmit={go} className="card relative mt-9 max-w-xl p-1.5">
      <div className="relative rounded-[15px] bg-ink-2 p-2">
        <div className="relative">
          <input
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            className="w-full bg-transparent px-4 pb-2 pt-3 text-lg font-medium outline-none"
            aria-label="Crypto price call"
          />
          {!claim && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden px-4 pb-2 pt-3 text-lg text-white/30">
              <AnimatePresence mode="wait">
                <motion.span
                  key={i}
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -18, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="block"
                >
                  &ldquo;{ROTATING[i]}&rdquo;
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-2 pb-1">
          <input
            value={by}
            onChange={(e) => setBy(e.target.value)}
            placeholder="@who said it"
            className="min-w-0 flex-1 rounded-full bg-white/[0.04] px-4 py-2.5 font-mono text-sm outline-none placeholder:text-white/30"
          />
          <button className="btn-bnb whitespace-nowrap px-5 py-2.5 text-sm">Print receipt →</button>
        </div>
      </div>
    </form>
  );
}
