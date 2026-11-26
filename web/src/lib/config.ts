import { getAddress, isAddress, type Hex } from "viem";

/** RECEIPTS Diamond on BSC testnet (chainId 97). Env can override; the default keeps deploys working
 *  even when NEXT_PUBLIC_* vars were added after the build (they are inlined at build time). */
export const DEFAULT_REGISTRY = "0xcAe4378872F3072A11489A69Fe075681701aed0B";

function pick(): Hex {
  for (const v of [process.env.NEXT_PUBLIC_REGISTRY_ADDRESS, process.env.REGISTRY_ADDRESS]) {
    const t = (v ?? "").trim().replace(/^["']|["']$/g, "");
    if (t && isAddress(t) && !/^0x0{40}$/i.test(t)) return getAddress(t);
  }
  return DEFAULT_REGISTRY;
}

export const REGISTRY_ADDRESS: Hex = pick();
