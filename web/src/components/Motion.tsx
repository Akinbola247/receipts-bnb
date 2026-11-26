"use client";

import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef } from "react";

export function Reveal({ children, delay = 0, className = "", y = 24 }: { children: React.ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function CountUp({ to, suffix = "", decimals = 0, className = "" }: { to: number; suffix?: string; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const txt = useTransform(mv, (v) => v.toFixed(decimals) + suffix);
  useEffect(() => {
    if (inView) {
      const c = animate(mv, to, { duration: 1.6, ease: [0.22, 1, 0.36, 1] });
      return () => c.stop();
    }
  }, [inView, to, mv]);
  return <motion.span ref={ref} className={className}>{txt}</motion.span>;
}

export function FloatSlip({ children, delay = 0, rotate = 0, className = "" }: { children: React.ReactNode; delay?: number; rotate?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 60, rotate: rotate - 6 }}
      animate={{ opacity: 1, y: [0, -10, 0], rotate }}
      transition={{
        opacity: { duration: 0.8, delay },
        rotate: { duration: 0.9, delay, type: "spring" },
        y: { duration: 6, delay: delay + 0.8, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      {children}
    </motion.div>
  );
}
