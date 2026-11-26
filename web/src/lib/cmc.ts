import "server-only";

// CoinMarketCap Pro API — server-side only (key never reaches the browser).
// Responses are cached in-memory + via Next's fetch cache to stay well inside the free Basic plan.

const BASE = "https://pro-api.coinmarketcap.com";

export type MarketSnapshot = {
  asset: string;
  name: string;
  price: number;
  change1h: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  marketCap: number;
  rank: number;
  fearGreed: number;
  fearGreedLabel: string;
  btcDominance: number;
  totalMarketCap: number;
  fetchedAt: string;
  source: "coinmarketcap";
};

const memo = new Map<string, { at: number; data: unknown }>();

async function cmc<T>(path: string, ttlSec: number): Promise<T> {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.at < ttlSec * 1000) return hit.data as T;
  const key = process.env.CMC_API_KEY;
  if (!key) throw new Error("CMC_API_KEY missing");
  const res = await fetch(BASE + path, {
    headers: { "X-CMC_PRO_API_KEY": key, Accept: "application/json" },
    next: { revalidate: ttlSec },
  });
  const j = await res.json();
  if (!res.ok || (j.status && j.status.error_code && String(j.status.error_code) !== "0")) {
    throw new Error(`CMC ${path} failed: ${j.status?.error_message ?? res.status}`);
  }
  memo.set(path, { at: Date.now(), data: j });
  return j as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getSnapshot(asset: string): Promise<MarketSnapshot> {
  const sym = asset.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "BNB";
  const [q, fg, gm] = await Promise.all([
    cmc<any>(`/v2/cryptocurrency/quotes/latest?symbol=${sym}`, 60),
    cmc<any>(`/v3/fear-and-greed/latest`, 600),
    cmc<any>(`/v1/global-metrics/quotes/latest`, 300),
  ]);
  const list = q.data?.[sym];
  const coin = Array.isArray(list) ? list.sort((a: any, b: any) => (a.cmc_rank ?? 1e9) - (b.cmc_rank ?? 1e9))[0] : list;
  if (!coin) throw new Error(`Unknown asset ${sym}`);
  const usd = coin.quote.USD;
  return {
    asset: sym,
    name: coin.name,
    price: usd.price,
    change1h: usd.percent_change_1h,
    change24h: usd.percent_change_24h,
    change7d: usd.percent_change_7d,
    volume24h: usd.volume_24h,
    marketCap: usd.market_cap,
    rank: coin.cmc_rank,
    fearGreed: Number(fg.data?.value ?? 50),
    fearGreedLabel: fg.data?.value_classification ?? "Neutral",
    btcDominance: gm.data?.btc_dominance ?? 0,
    totalMarketCap: gm.data?.quote?.USD?.total_market_cap ?? 0,
    fetchedAt: new Date().toISOString(),
    source: "coinmarketcap",
  };
}

export type TickerCoin = { symbol: string; price: number; change24h: number };

export async function getTicker(): Promise<TickerCoin[]> {
  const syms = "BNB,BTC,ETH,SOL,XRP,DOGE,CAKE,TON,ADA,LINK";
  const q = await cmc<any>(`/v2/cryptocurrency/quotes/latest?symbol=${syms}`, 60);
  return syms.split(",").flatMap((s) => {
    const arr = q.data?.[s];
    const c = Array.isArray(arr) ? arr[0] : arr;
    if (!c) return [];
    return [{ symbol: s, price: c.quote.USD.price, change24h: c.quote.USD.percent_change_24h }];
  });
}
