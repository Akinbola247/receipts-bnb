import { NextResponse } from "next/server";
import { publicClient, REGISTRY } from "@/lib/chain";
import { registryAbi } from "@/lib/abi";

export const dynamic = "force-dynamic";

// Reports configuration presence only (never values) so deploys can be diagnosed safely.
export async function GET() {
  const out: Record<string, unknown> = {
    registry: REGISTRY,
    cmcKey: Boolean(process.env.CMC_API_KEY?.trim()),
    relayerKey: Boolean(process.env.RELAYER_PRIVATE_KEY?.trim()),
    cournotKey: Boolean(process.env.COURNOT_API_KEY?.trim()),
  };
  try {
    out.chainId = await publicClient.getChainId();
    out.receipts = Number(await publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: "totalReceipts" }));
    out.chain = "ok";
  } catch (e) {
    out.chain = `error: ${(e as Error).message.slice(0, 120)}`;
  }
  return NextResponse.json(out);
}
