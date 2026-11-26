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
  STRK: "STRK",
  STARKNET: "STRK",
  ARB: "ARB",
  ARBITRUM: "ARB",
  OP: "OP",
  OPTIMISM: "OP",
  APT: "APT",
  APTOS: "APT",
  NEAR: "NEAR",
  DOT: "DOT",
  POLKADOT: "DOT",
  LTC: "LTC",
  LITECOIN: "LTC",
  BCH: "BCH",
  SHIB: "SHIB",
  WIF: "WIF",
  BONK: "BONK",
  TRUMP: "TRUMP",
  TIA: "TIA",
  CELESTIA: "TIA",
  INJ: "INJ",
  INJECTIVE: "INJ",
  SEI: "SEI",
  ENA: "ENA",
  ETHENA: "ENA",
  AAVE: "AAVE",
  UNI: "UNI",
  UNISWAP: "UNI",
  ZEC: "ZEC",
  ZCASH: "ZEC",
  XLM: "XLM",
  STELLAR: "XLM",
  HBAR: "HBAR",
  HEDERA: "HBAR",
  MATIC: "POL",
  POL: "POL",
  POLYGON: "POL",
  TAO: "TAO",
  BITTENSOR: "TAO",
  ONDO: "ONDO",
  PAXG: "PAXG",
  XAUT: "XAUT",
  GOLD: "PAXG",
  ASTER: "ASTER",
};

const STOP = new Set(["THE", "WILL", "HIT", "BY", "TO", "AND", "FOR", "THIS", "YEAR", "END", "OF", "BEFORE", "AFTER", "ABOVE", "BELOW", "USD", "PRICE", "IN", "ON", "AT", "IS", "A", "IT", "MY", "ALL", "ATH", "NEW", "DEC", "JAN", "Q1", "Q2", "Q3", "Q4", "EOY", "NOT", "NFA", "DYOR", "GM", "WAGMI", "NGMI", "SOON", "BULL", "BEAR", "RUN", "MOON", "PUMP", "DUMP", "SEND", "IT", "CRYPTO", "COIN", "TOKEN", "UP", "DOWN"]);

/** Every name a market title might use for an asset (ticker + long names). */
export function assetNames(asset: string): string[] {
  const names = Object.entries(ALIASES)
    .filter(([, v]) => v === asset)
    .map(([k]) => k);
  return [...new Set([asset, ...names])];
}

/** Detect the asset a claim is about. Defaults to BNB (we're on BNB Chain). */
export function detectAsset(claim: string): string {
  const words = claim.toUpperCase().replace(/[^A-Z0-9$ ]/g, " ").split(/\s+/).filter(Boolean);
  for (const w of words) {
    const k = w.replace(/^\$/, "");
    if (ALIASES[k]) return ALIASES[k];
  }
  // unknown project: an explicit $TICKER (cashtag) wins, otherwise the first ticker-looking word
  const cash = claim.match(/\$([A-Za-z][A-Za-z0-9]{1,9})\b/);
  if (cash) return cash[1].toUpperCase();
  const tick = words.find((w) => /^[A-Z][A-Z0-9]{1,9}$/.test(w) && !STOP.has(w));
  if (tick) return tick;
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
