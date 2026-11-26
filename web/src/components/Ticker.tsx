import { getTicker, type TickerCoin } from "@/lib/cmc";

export async function Ticker() {
  let coins: TickerCoin[] = [];
  try {
    coins = await getTicker();
  } catch {
    return null;
  }
  if (!coins.length) return null;
  const row = [...coins, ...coins];
  return (
    <div className="relative overflow-hidden border-b border-line/60 bg-ink-2/60 py-2.5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-ink to-transparent" />
      <div className="marquee flex w-max gap-10 font-mono text-xs">
        {row.map((c, i) => (
          <span key={i} className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-bold text-white/85">{c.symbol}</span>
            <span className="text-white/55">
              ${c.price >= 1 ? c.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : c.price.toPrecision(3)}
            </span>
            <span className={c.change24h >= 0 ? "text-good" : "text-bad"}>
              {c.change24h >= 0 ? "▲" : "▼"} {Math.abs(c.change24h).toFixed(2)}%
            </span>
          </span>
        ))}
        <span className="whitespace-nowrap text-white/30">LIVE · COINMARKETCAP PRO API</span>
      </div>
    </div>
  );
}
