import { NextResponse } from "next/server";
import { COURNOT_UPSTREAM } from "@/lib/cournot-server";

// Cournot rejects browser-originated requests (any Origin header → code 5000),
// so the app proxies through the server. /resolve is free.
const memo = new Map<string, { at: number; body: string }>();

export async function POST(req: Request) {
  let message = "";
  let limit = 5;
  try {
    const b = await req.json();
    message = String(b.message ?? "").trim().slice(0, 280);
    limit = Math.min(10, Math.max(1, Number(b.limit) || 5));
  } catch {}
  if (message.length < 4) return NextResponse.json({ code: 400, msg: "message required" }, { status: 400 });

  const key = `${message.toLowerCase()}|${limit}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 120_000) return new NextResponse(hit.body, { headers: { "content-type": "application/json", "x-cache": "hit" } });

  const res = await fetch(`${COURNOT_UPSTREAM}/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, limit }),
    signal: AbortSignal.timeout(25_000),
  }).catch(() => null);
  if (!res) return NextResponse.json({ code: 503, msg: "Cournot unreachable" }, { status: 503 });
  const body = await res.text();
  if (res.ok) {
    try {
      if (JSON.parse(body).code === 0) memo.set(key, { at: Date.now(), body });
    } catch {}
  }
  return new NextResponse(body, { status: res.status, headers: { "content-type": "application/json" } });
}
