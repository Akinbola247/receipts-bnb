import { NextResponse } from "next/server";
import { anchorReceipt, isConfigured } from "@/lib/chain";
import { getSnapshot } from "@/lib/cmc";
import { detectAsset, normalizeHandle } from "@/lib/assets";
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

  let body: { claim?: string; caller?: string; raw?: string; marketId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const claim = (body.claim ?? "").trim().slice(0, 280);
  const caller = normalizeHandle(body.caller ?? "");
  const raw = redactEvidence(body.raw ?? "");
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

  // 2) Independent integrity check: the market must really exist on Cournot (free resolve endpoint).
  try {
    const r = await fetch(`${COURNOT_BASE}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: market.market_info.title, limit: 10 }),
      signal: AbortSignal.timeout(12_000),
    });
    const j = await r.json();
    const ok = (j?.data?.markets ?? []).some((m: { market_info: { id: number } }) => m.market_info.id === market.market_info.id);
    if (!ok) return NextResponse.json({ error: "Market could not be verified on Cournot" }, { status: 422 });
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
    });
    return NextResponse.json({ id, txHash, snapshot: snap });
  } catch (e) {
    const msg = (e as Error).message || "";
    const friendly = /insufficient funds/i.test(msg) ? "Relayer is out of testnet gas — try again shortly." : "On-chain anchoring failed.";
    console.error("anchor failed", msg);
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}
