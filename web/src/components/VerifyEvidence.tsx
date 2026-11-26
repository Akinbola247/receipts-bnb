"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { keccak256, toBytes } from "viem";

/** Recomputes keccak256 of the evidence pulled from the chain log, in the visitor's browser,
 *  and compares it to the hash stored in the receipt. Trust nobody — not even us. */
export function VerifyEvidence({ json, expected }: { json: string; expected: string }) {
  const [state, setState] = useState<"idle" | "ok" | "bad">("idle");
  const [hash, setHash] = useState("");
  return (
    <div>
      <button
        onClick={() => {
          const h = keccak256(toBytes(json));
          setHash(h);
          setState(h.toLowerCase() === expected.toLowerCase() ? "ok" : "bad");
        }}
        className="btn-bnb px-5 py-2.5 text-sm"
      >
        Verify evidence in my browser
      </button>
      <AnimatePresence>
        {state !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 rounded-xl border p-4 font-mono text-xs ${state === "ok" ? "border-good/40 bg-good/10" : "border-bad/40 bg-bad/10"}`}
          >
            <div className={`text-sm font-bold ${state === "ok" ? "text-good" : "text-bad"}`}>
              {state === "ok" ? "✔ MATCH: evidence is byte-for-byte what was anchored" : "✘ MISMATCH: evidence was altered"}
            </div>
            <div className="mt-2 break-all text-white/60">computed {hash}</div>
            <div className="break-all text-white/60">on-chain {expected}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
