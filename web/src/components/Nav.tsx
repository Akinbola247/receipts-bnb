"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/check", label: "Check a call" },
  { href: "/ledger", label: "Ledger" },
  { href: "/hall", label: "Hall of Hype" },
  { href: "/how", label: "How it works" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <Logo />
          <span className="font-mono text-[15px] font-bold tracking-[0.25em]">RECEIPTS</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = path === l.href || (l.href !== "/" && path.startsWith(l.href));
            return (
              <Link key={l.href} href={l.href} className="relative rounded-full px-4 py-2 text-sm text-white/70 transition hover:text-white">
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-white/[0.07] ring-1 ring-white/10"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className={`relative ${active ? "text-white" : ""}`}>{l.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 font-mono text-[11px] text-white/60 sm:flex">
            <span className="live-dot" /> BSC TESTNET
          </span>
          <Link href="/check" className="btn-bnb px-4 py-2 text-sm">
            Get a receipt
          </Link>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${path.startsWith(l.href) ? "bg-white/10 text-white" : "text-white/60"}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
