export const pct = (bps: number, digits = 0) => `${(bps / 100).toFixed(digits)}%`;

export function usd(n: number) {
  if (!isFinite(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
}

export const signed = (n: number, d = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;

export const short = (h: string, a = 6, b = 4) => (h.length > a + b + 2 ? `${h.slice(0, a)}…${h.slice(-b)}` : h);

export function ago(unix: number) {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - unix));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function stamp(unix: number) {
  return new Date(unix * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function receiptNo(id: number) {
  return `#${String(id).padStart(6, "0")}`;
}
