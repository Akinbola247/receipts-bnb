import "server-only";
import { createPublicClient, createWalletClient, http, keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { registryAbi } from "./abi";
import { verdictFromIndex, type VerdictKey } from "./verdict";

export const REGISTRY = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "0x0000000000000000000000000000000000000000") as Hex;
const RPC = process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";

export const publicClient = createPublicClient({ chain: bscTestnet, transport: http(RPC, { retryCount: 2 }) });

export type ReceiptView = {
  id: number;
  marketId: number;
  probabilityBps: number;
  verdict: VerdictKey;
  outcome: "PENDING" | "HIT" | "MISS";
  fearGreed: number;
  createdAt: number;
  blockNumber: number;
  resolvesAt: number;
  spotPrice: number;
  attester: Hex;
  callerHash: Hex;
  evidenceHash: Hex;
  caller: string;
  asset: string;
  claim: string;
};

const OUTCOMES = ["PENDING", "HIT", "MISS"] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toView(id: bigint | number, r: any): ReceiptView {
  return {
    id: Number(id),
    marketId: Number(r.marketId),
    probabilityBps: Number(r.probabilityBps),
    verdict: verdictFromIndex(Number(r.verdict)),
    outcome: OUTCOMES[Number(r.outcome)] ?? "PENDING",
    fearGreed: Number(r.fearGreed),
    createdAt: Number(r.createdAt),
    blockNumber: Number(r.blockNumber),
    resolvesAt: Number(r.resolvesAt),
    spotPrice: Number(r.spotPriceE8) / 1e8,
    attester: r.attester,
    callerHash: r.callerHash,
    evidenceHash: r.evidenceHash,
    caller: r.caller,
    asset: r.asset,
    claim: r.claim,
  };
}

export const isConfigured = () => REGISTRY !== "0x0000000000000000000000000000000000000000";

export async function getTotals() {
  if (!isConfigured()) return { receipts: 0, callers: 0 };
  const [receipts, callers] = await Promise.all([
    publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: "totalReceipts" }),
    publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: "totalCallers" }),
  ]);
  return { receipts: Number(receipts), callers: Number(callers) };
}

export async function getLatest(offset = 0, limit = 30): Promise<ReceiptView[]> {
  if (!isConfigured()) return [];
  const [rows, ids] = (await publicClient.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "latest",
    args: [BigInt(offset), BigInt(limit)],
  })) as [any[], bigint[]];
  return rows.map((r, i) => toView(ids[i], r));
}

export async function getReceipt(id: number): Promise<ReceiptView | null> {
  if (!isConfigured()) return null;
  try {
    const r = await publicClient.readContract({
      address: REGISTRY,
      abi: registryAbi,
      functionName: "getReceipt",
      args: [BigInt(id)],
    });
    return toView(id, r);
  } catch {
    return null;
  }
}

/** Pull the full evidence JSON + tx hash straight from the event log at the receipt's block. */
export async function getEvidence(r: ReceiptView): Promise<{ json: string; txHash: Hex } | null> {
  const logs = await publicClient.getContractEvents({
    address: REGISTRY,
    abi: registryAbi,
    eventName: "ReceiptAnchored",
    args: { id: BigInt(r.id) },
    fromBlock: BigInt(r.blockNumber),
    toBlock: BigInt(r.blockNumber),
  });
  const log = logs[0];
  if (!log) return null;
  return { json: (log.args as any).evidenceJson as string, txHash: log.transactionHash as Hex };
}

export type CallerView = {
  hash: Hex;
  handle: string;
  calls: number;
  hits: number;
  misses: number;
  avgBps: number;
  alphaBps: number;
};

export async function getCallers(): Promise<CallerView[]> {
  if (!isConfigured()) return [];
  const rows = (await publicClient.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "callers",
    args: [BigInt(0), BigInt(500)],
  })) as any[];
  return rows.map((c) => ({
    hash: c.hash,
    handle: c.handle,
    calls: Number(c.stats.calls),
    hits: Number(c.stats.hits),
    misses: Number(c.stats.misses),
    avgBps: Number(c.stats.calls) ? Number(c.stats.sumProbabilityBps) / Number(c.stats.calls) : 0,
    alphaBps: Number(c.stats.alphaBps),
  }));
}

export async function getCaller(handle: string): Promise<CallerView | null> {
  if (!isConfigured()) return null;
  const hash = keccak256(toBytes(handle));
  const s = (await publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: "callerStatsOf", args: [hash] })) as any;
  if (!Number(s.calls)) return null;
  return {
    hash,
    handle,
    calls: Number(s.calls),
    hits: Number(s.hits),
    misses: Number(s.misses),
    avgBps: Number(s.sumProbabilityBps) / Number(s.calls),
    alphaBps: Number(s.alphaBps),
  };
}

export type FacetInfo = { address: Hex; selectors: Hex[] };

/** Live EIP-2535 loupe read — the architecture page renders the diamond's real routing table. */
export async function getFacets(): Promise<FacetInfo[]> {
  if (!isConfigured()) return [];
  const f = (await publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: "facets" })) as any[];
  return f.map((x) => ({ address: x.facetAddress, selectors: x.functionSelectors }));
}

export async function getCallerReceipts(handle: string): Promise<ReceiptView[]> {
  if (!isConfigured()) return [];
  const hash = keccak256(toBytes(handle));
  const ids = (await publicClient.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "receiptsOf",
    args: [hash],
  })) as bigint[];
  const rows = await Promise.all(ids.slice(-50).reverse().map((id) => getReceipt(Number(id))));
  return rows.filter(Boolean) as ReceiptView[];
}

// ───────────── relayer (gas sponsor) ─────────────

let queue: Promise<unknown> = Promise.resolve();

export type AnchorArgs = {
  marketId: number;
  probabilityBps: number;
  fearGreed: number;
  resolvesAt: number;
  spotPriceE8: bigint;
  caller: string;
  asset: string;
  claim: string;
  evidenceJson: string;
};

/** Serialised so concurrent requests never collide on nonces. */
export function anchorReceipt(a: AnchorArgs): Promise<{ txHash: Hex; id: number }> {
  const run = async () => {
    const pk = process.env.RELAYER_PRIVATE_KEY as Hex | undefined;
    if (!pk) throw new Error("Relayer not configured");
    const account = privateKeyToAccount(pk);
    const wallet = createWalletClient({ account, chain: bscTestnet, transport: http(RPC) });
    const args = {
      marketId: BigInt(a.marketId),
      probabilityBps: a.probabilityBps,
      fearGreed: a.fearGreed,
      resolvesAt: BigInt(a.resolvesAt),
      spotPriceE8: a.spotPriceE8,
      caller: a.caller,
      asset: a.asset,
      claim: a.claim,
      evidenceJson: a.evidenceJson,
    } as const;
    const { request, result } = await publicClient.simulateContract({
      account,
      address: REGISTRY,
      abi: registryAbi,
      functionName: "anchor",
      args: [args],
    });
    const txHash = await wallet.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
    return { txHash, id: Number(result) };
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export const EXPLORER = "https://testnet.bscscan.com";
