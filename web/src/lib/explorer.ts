import "server-only";
import { decodeEventLog, decodeFunctionData, type Hex, type Log } from "viem";
import { registryAbi } from "./abi";
import { publicClient, REGISTRY } from "./chain";

/** First block of the RECEIPTS diamond on BSC testnet (facet deployments). */
export const DEPLOY_BLOCK = BigInt(process.env.REGISTRY_DEPLOY_BLOCK || "145057400");
const CHUNK = 45_000n; // public RPCs cap eth_getLogs ranges at 50k blocks

export type ActivityEvent = {
  name: string;
  args: Record<string, unknown>;
  blockNumber: number;
  txHash: Hex;
  logIndex: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function decode(l: Log): ActivityEvent | null {
  try {
    const d = decodeEventLog({ abi: registryAbi, data: l.data, topics: l.topics as any });
    return {
      name: d.eventName as string,
      args: (d.args ?? {}) as Record<string, unknown>,
      blockNumber: Number(l.blockNumber),
      txHash: l.transactionHash as Hex,
      logIndex: Number(l.logIndex),
    };
  } catch {
    return null;
  }
}

/** Every event the diamond ever emitted, newest first (chunked getLogs). */
export async function getActivity(): Promise<{ events: ActivityEvent[]; head: number }> {
  const head = await publicClient.getBlockNumber();
  const ranges: [bigint, bigint][] = [];
  for (let from = DEPLOY_BLOCK; from <= head; from += CHUNK) {
    const to = from + CHUNK - 1n > head ? head : from + CHUNK - 1n;
    ranges.push([from, to]);
  }
  const chunks = await Promise.all(
    ranges.map(([fromBlock, toBlock]) => publicClient.getLogs({ address: REGISTRY, fromBlock, toBlock }).catch(() => [] as Log[])),
  );
  const events = chunks
    .flat()
    .map(decode)
    .filter(Boolean) as ActivityEvent[];
  events.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
  return { events, head: Number(head) };
}

export type TxDetail = {
  hash: Hex;
  from: Hex;
  to: Hex | null;
  blockNumber: number;
  timestamp: number;
  status: "success" | "reverted";
  gasUsed: bigint;
  gasPrice: bigint;
  fee: bigint;
  method: string;
  args: unknown;
  inputBytes: number;
  events: ActivityEvent[];
};

export async function getTx(hash: Hex): Promise<TxDetail | null> {
  try {
    const [tx, rcpt] = await Promise.all([publicClient.getTransaction({ hash }), publicClient.getTransactionReceipt({ hash })]);
    const block = await publicClient.getBlock({ blockNumber: rcpt.blockNumber });
    let method = tx.to ? "unknown" : "contract creation";
    let args: unknown = null;
    if (tx.to && tx.input && tx.input !== "0x") {
      try {
        const d = decodeFunctionData({ abi: registryAbi, data: tx.input });
        method = d.functionName as string;
        args = d.args;
      } catch {
        method = tx.input.slice(0, 10);
      }
    }
    const events = rcpt.logs
      .filter((l) => l.address.toLowerCase() === REGISTRY.toLowerCase())
      .map((l) => decode(l as unknown as Log))
      .filter(Boolean) as ActivityEvent[];
    const gasPrice = rcpt.effectiveGasPrice ?? tx.gasPrice ?? 0n;
    return {
      hash,
      from: tx.from,
      to: tx.to ?? null,
      blockNumber: Number(rcpt.blockNumber),
      timestamp: Number(block.timestamp),
      status: rcpt.status,
      gasUsed: rcpt.gasUsed,
      gasPrice,
      fee: rcpt.gasUsed * gasPrice,
      method,
      args,
      inputBytes: (tx.input.length - 2) / 2,
      events,
    };
  } catch {
    return null;
  }
}

export async function getBlockTimes(blocks: number[]): Promise<Record<number, number>> {
  const uniq = [...new Set(blocks)].slice(0, 60);
  const out: Record<number, number> = {};
  await Promise.all(
    uniq.map(async (b) => {
      try {
        out[b] = Number((await publicClient.getBlock({ blockNumber: BigInt(b) })).timestamp);
      } catch {}
    }),
  );
  return out;
}
