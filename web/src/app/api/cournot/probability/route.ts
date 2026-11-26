import { NextResponse } from "next/server";
import { COURNOT_UPSTREAM, SERVER_COURNOT_KEY } from "@/lib/cournot-server";
import { redactEvidence } from "@/lib/cournot";

export const maxDuration = 60;

// Short-lived memo so a burst of people checking the same call costs ONE oracle query.
// Longer-lived reuse comes from the on-chain cache (/api/cache).
const memo = new Map<string, { at: number; body: string }>();
const TTL = 10 * 60_000;

export async function POST(req: Request) {
  let message = "";
  let marketIds: number[] = [];
  try {
    const b = await req.json();
    message = String(b.message ?? "").trim().slice(0, 280);
    marketIds = (Array.isArray(b.market_ids) ? b.market_ids : []).map(Number).filter((n: number) => Number.isFinite(n) && n > 0).slice(0, 10);
  } catch {}
  if (message.length < 4 || !marketIds.length) return NextResponse.json({ code: 400, msg: "message and market_ids required" }, { status: 400 });

  const memoKey = `${marketIds.join(",")}|${message.toLowerCase()}`;
  const hit = memo.get(memoKey);
  if (hit && Date.now() - hit.at < TTL) return new NextResponse(hit.body, { headers: { "content-type": "application/json", "x-cache": "hit" } });

  // Key precedence: user-supplied (header, never stored) → server partner key → server free quota.
  const userKey = req.headers.get("x-cournot-key")?.trim();
  const apiKey = userKey && /^ck_live_[A-Za-z0-9_-]+$/.test(userKey) ? userKey : SERVER_COURNOT_KEY;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers["COURNOT-API-KEY"] = apiKey;

  const res = await fetch(`${COURNOT_UPSTREAM}/probability`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, market_ids: marketIds }),
    signal: AbortSignal.timeout(110_000),
  }).catch(() => null);
  if (!res) return NextResponse.json({ code: 503, msg: "Cournot unreachable" }, { status: 503 });

  // 402 = quota exhausted → we do not pay; the client falls back to the on-chain cache.
  if (res.status === 402) return NextResponse.json({ code: 402, msg: "quota" }, { status: 402 });
  if (res.status === 429) return NextResponse.json({ code: 429, msg: "rate limited" }, { status: 429 });

  const body = redactEvidence(await res.text());
  try {
    const j = JSON.parse(body);
    if (j.code === 0 && typeof j.data?.probability === "number") memo.set(memoKey, { at: Date.now(), body });
  } catch {}
  return new NextResponse(body, { status: res.status, headers: { "content-type": "application/json" } });
}
