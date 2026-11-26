import { NextResponse } from "next/server";
import { anchorReceipt, isConfigured } from "@/lib/chain";
import { getSnapshot } from "@/lib/cmc";
import { detectAsset, normalizeHandle } from "@/lib/assets";
import { matchMarket } from "@/lib/match";
import { COURNOT_BASE, redactEvidence, type CournotProbability } from "@/lib/cournot";

export const maxDuration = 60;

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 6;
}

export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "Registry not deployed yet" }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "Slow down — max 6 receipts a minute." }, { status: 429 });

  let body: { claim?: string; caller?: string; raw?: string; marketId?: number; sourceUrl?: string; postedAt?: string | number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const claim = (body.claim ?? "").trim().slice(0, 280);
  const caller = normalizeHandle(body.caller ?? "");
  const raw = redactEvidence(body.raw ?? "");
  // Provenance: optional link to the original post (stored write-once on-chain by SourceFacet).
  let sourceUrl: string | undefined;
  let postedAt = 0;
  if (body.sourceUrl && String(body.sourceUrl).trim()) {
    try {
      const u = new URL(String(body.sourceUrl).trim());
      if (u.protocol !== "https:") throw new Error();
      u.hash = "";
      sourceUrl = u.toString().slice(0, 300);
    } catch {
      return NextResponse.json({ error: "Source must be an https:// link to the original post" }, { status: 400 });
    }
    const t = typeof body.postedAt === "number" ? body.postedAt : Date.parse(String(body.postedAt ?? "")) / 1000;
    postedAt = Number.isFinite(t) && t > 0 ? Math.min(Math.floor(t), Math.floor(Date.now() / 1000) - 60) : 0;
  }
  if (claim.length < 6) return NextResponse.json({ error: "Claim is too short" }, { status: 400 });
  if (!raw || raw.length > 16_000) return NextResponse.json({ error: "Missing or oversized Cournot evidence" }, { status: 400 });

  // 1) Validate the Cournot response the browser received.
  let parsed: CournotProbability;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Evidence is not valid JSON" }, { status: 400 });
  }
  const p = parsed?.data?.probability;
  const market = parsed?.data?.markets?.find((m) => m.market_info.id === Number(body.marketId)) ?? parsed?.data?.markets?.[0];
  if (parsed.code !== 0 || typeof p !== "number" || p < 0 || p > 1 || !market) {
    return NextResponse.json({ error: "Evidence is not a successful Cournot probability response" }, { status: 400 });
  }

  // 1b) The market must actually price THIS call (same asset & direction; exact threshold or an easier one = upper bound).
  const match = matchMarket(claim, [market]);
  if (!match.ok) return NextResponse.json({ error: `That market doesn't price this call: ${match.reason}` }, { status: 422 });

  // 2) Independent integrity check: the market must really exist on Cournot (free resolve endpoint).
  //    Query with both the user's claim (which surfaced it) and the market title; either hit verifies it.
  try {
    const lookup = (message: string) =>
      fetch(`${COURNOT_BASE}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, limit: 10 }),
        signal: AbortSignal.timeout(12_000),
      })
        .then((r) => r.json())
        .then((j) => (j?.data?.markets ?? []).some((m: { market_info: { id: number } }) => m.market_info.id === market.market_info.id))
        .catch(() => null);
    const results = await Promise.all([lookup(claim), lookup(market.market_info.title)]);
    if (results.every((x) => x === false)) return NextResponse.json({ error: "Market could not be verified on Cournot" }, { status: 422 });
  } catch {
    // Cournot unreachable from server — the evidence hash is still anchored, so this stays auditable.
  }

  // 3) Server-side CoinMarketCap snapshot (trusted, key stays on the server).
  const asset = detectAsset(`${claim} ${market.market_info.title}`);
  let snap;
  try {
    snap = await getSnapshot(asset);
  } catch {
    snap = await getSnapshot("BNB");
  }

  const resolvesAt = Math.floor(new Date(market.market_info.end_time || Date.now()).getTime() / 1000) || 0;
  try {
    const { txHash, id } = await anchorReceipt({
      marketId: market.market_info.id,
      probabilityBps: Math.round(p * 10000),
      fearGreed: Math.max(0, Math.min(100, Math.round(snap.fearGreed))),
      resolvesAt,
      spotPriceE8: BigInt(Math.round(snap.price * 1e8)),
      caller,
      asset: snap.asset,
      claim,
      evidenceJson: raw,
      sourceUrl,
      postedAt,
    });
    return NextResponse.json({ id, txHash, snapshot: snap });
  } catch (e) {
    const msg = (e as Error).message || "";
    const friendly = /insufficient funds/i.test(msg)
      ? "Relayer is out of testnet gas — try again shortly."
      : /Relayer not configured/.test(msg)
        ? "Server is missing RELAYER_PRIVATE_KEY."
        : /NotAttester/.test(msg)
          ? "Relayer key is not an authorised attester on the Diamond."
          : "On-chain anchoring failed.";
    console.error("anchor failed", msg);
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}
