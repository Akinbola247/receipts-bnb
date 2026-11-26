import { NextResponse } from "next/server";
import { getEvidence, getLatest } from "@/lib/chain";

// The chain *is* the shared cache: if any visitor already paid (with their free quota) for this
// market's probability recently, everyone else can reuse that anchored, verifiable answer.
export async function GET(req: Request) {
  const marketId = Number(new URL(req.url).searchParams.get("marketId"));
  if (!marketId) return NextResponse.json({ hit: null });
  const rows = await getLatest(0, 200);
  const sixHours = 6 * 3600;
  const now = Math.floor(Date.now() / 1000);
  const hit = rows.find((r) => r.marketId === marketId && now - r.createdAt < sixHours);
  if (!hit) return NextResponse.json({ hit: null });
  const ev = await getEvidence(hit);
  return NextResponse.json({ hit, raw: ev?.json ?? null, txHash: ev?.txHash ?? null });
}
