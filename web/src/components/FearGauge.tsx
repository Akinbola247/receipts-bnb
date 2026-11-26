"use client";

import { motion } from "motion/react";

export function FearGauge({ value, label }: { value: number; label: string }) {
  const angle = -90 + (Math.max(0, Math.min(100, value)) / 100) * 180;
  const color = value <= 25 ? "#ff3b5c" : value <= 45 ? "#ff8a3d" : value <= 55 ? "#f0b90b" : value <= 75 ? "#9be15d" : "#2bd67b";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 116" className="w-full max-w-[220px]">
        <defs>
          <linearGradient id="fg" x1="0" x2="1">
            <stop offset="0%" stopColor="#ff3b5c" />
            <stop offset="35%" stopColor="#ff8a3d" />
            <stop offset="50%" stopColor="#f0b90b" />
            <stop offset="75%" stopColor="#9be15d" />
            <stop offset="100%" stopColor="#2bd67b" />
          </linearGradient>
        </defs>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#1f1f25" strokeWidth="14" strokeLinecap="round" />
        <motion.path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#fg)"
          strokeWidth="14"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <motion.g
          style={{ originX: "100px", originY: "100px" }}
          initial={{ rotate: -90 }}
          whileInView={{ rotate: angle }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 60, damping: 9, delay: 0.3 }}
        >
          <line x1="100" y1="100" x2="100" y2="34" stroke="#f5f1e8" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
        <circle cx="100" cy="100" r="7" fill="#f5f1e8" />
      </svg>
      <div className="-mt-2 text-4xl font-extrabold" style={{ color }}>
        {value}
      </div>
      <div className="font-mono text-[11px] uppercase tracking-widest text-white/50">{label}</div>
    </div>
  );
}
