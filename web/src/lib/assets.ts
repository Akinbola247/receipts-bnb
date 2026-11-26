const ALIASES: Record<string, string> = {
  BNB: "BNB",
  BINANCE: "BNB",
  BTC: "BTC",
  BITCOIN: "BTC",
  ETH: "ETH",
  ETHER: "ETH",
  ETHEREUM: "ETH",
  SOL: "SOL",
  SOLANA: "SOL",
  XRP: "XRP",
  RIPPLE: "XRP",
  DOGE: "DOGE",
  DOGECOIN: "DOGE",
  CAKE: "CAKE",
  PANCAKESWAP: "CAKE",
  ADA: "ADA",
  CARDANO: "ADA",
  TON: "TON",
  TRX: "TRX",
  TRON: "TRX",
  LINK: "LINK",
  CHAINLINK: "LINK",
  AVAX: "AVAX",
  SUI: "SUI",
  HYPE: "HYPE",
  PEPE: "PEPE",
};

/** Detect the asset a claim is about. Defaults to BNB (we're on BNB Chain). */
export function detectAsset(claim: string): string {
  const words = claim.toUpperCase().replace(/[^A-Z0-9$ ]/g, " ").split(/\s+/);
  for (const w of words) {
    const k = w.replace(/^\$/, "");
    if (ALIASES[k]) return ALIASES[k];
  }
  return "BNB";
}

export function normalizeHandle(h: string): string {
  const t = h.trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").replace(/[^A-Za-z0-9_@.]/g, "");
  if (!t) return "@anon";
  return ("@" + t.replace(/^@+/, "")).toLowerCase().slice(0, 32);
}

export const EXAMPLE_CALLS = [
  { caller: "@moonboy_bnb", claim: "BNB will be above $700 before December 1st" },
  { caller: "@btc_maxi", claim: "Bitcoin above $100,000 by end of 2026" },
  { caller: "@eth_ultrasound", claim: "ETH flips $5,000 before 2027" },
  { caller: "@sol_szn", claim: "SOL will hit $300 this year" },
];
