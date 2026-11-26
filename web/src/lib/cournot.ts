// Cournot Intelligence Oracle client (browser side).
// Cournot rejects browser-originated requests, so calls go through our thin server proxy
// (/api/cournot/*), which adds the partner key, redacts the IP and memoises results.

export const COURNOT_BASE = "https://interface.cournot.ai/intelligence/v1"; // upstream (server use)
const PROXY = "/api/cournot";

export type CournotMarket = {
  market_info: {
    id: number;
    title: string;
    description: string;
    end_time: string;
    market_outcome: string;
    market_outcome_price: number;
  };
  matching_confidence: number;
};

export type CournotBasis = { source: string; summary: string; time: string; url: string };

export type CournotProbability = {
  code: number;
  msg: string;
  data: {
    probability: number;
    markets: CournotMarket[];
    basis: CournotBasis[];
    billing?: string;
    charged?: boolean;
    free_quota?: { total: number; used: number; remaining: number; ip?: string } | null;
    api_key_quota?: { remaining: number } | null;
    x402?: unknown;
  };
};

export class CournotError extends Error {
  constructor(
    public kind: "quota" | "rate_limited" | "service" | "no_market" | "key_invalid",
    message: string,
  ) {
    super(message);
  }
}

function headers(apiKey?: string) {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) h["x-cournot-key"] = apiKey; // forwarded per-request by the proxy, never stored
  return h;
}

export async function resolveMarkets(message: string, limit = 5): Promise<CournotMarket[]> {
  const res = await fetch(`${PROXY}/resolve`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ message, limit }),
  });
  if (res.status === 429) throw new CournotError("rate_limited", "Cournot is rate limiting. Try again in a minute.");
  if (!res.ok) throw new CournotError("service", `Cournot resolve failed (${res.status})`);
  const j = await res.json();
  if (j.code !== 0) throw new CournotError("service", j.msg || "Cournot resolve error");
  const markets: CournotMarket[] = j.data?.markets ?? [];
  if (!markets.length) throw new CournotError("no_market", "No live prediction market matches this call yet.");
  return markets;
}

/**
 * Cournot echoes the caller's IP in `free_quota.ip`. That must never be written to a public chain,
 * so it is stripped from the exact text before hashing/anchoring (client AND server both apply this).
 */
export function redactEvidence(raw: string): string {
  return raw.replace(/"ip"\s*:\s*"[^"]*"\s*,/g, "").replace(/,\s*"ip"\s*:\s*"[^"]*"/g, "").replace(/"ip"\s*:\s*"[^"]*"/g, "");
}

/** Returns the parsed response AND the raw text (the raw text is hashed and anchored on-chain). */
export async function getProbability(
  message: string,
  marketIds: number[],
  apiKey?: string,
): Promise<{ parsed: CournotProbability; raw: string }> {
  const res = await fetch(`${PROXY}/probability`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ message, market_ids: marketIds }),
  });
  if (res.status === 402) throw new CournotError("quota", "The shared Cournot oracle quota is used up.");
  if (res.status === 429) throw new CournotError("rate_limited", "Cournot is rate limiting. Try again in a minute.");
  if (res.status === 401) throw new CournotError("key_invalid", "That Cournot API key was rejected.");
  const raw = redactEvidence(await res.text());
  let parsed: CournotProbability;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CournotError("service", "Cournot returned an unreadable response.");
  }
  if (parsed.code !== 0 || typeof parsed.data?.probability !== "number") {
    if (parsed.code === 4100) throw new CournotError("key_invalid", "That Cournot API key was rejected.");
    throw new CournotError("service", parsed.msg || "Cournot probability error");
  }
  return { parsed, raw };
}
