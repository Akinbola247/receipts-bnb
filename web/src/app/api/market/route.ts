import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/cmc";

export async function GET(req: Request) {
  const asset = new URL(req.url).searchParams.get("asset") || "BNB";
  try {
    const snap = await getSnapshot(asset);
    return NextResponse.json(snap, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
