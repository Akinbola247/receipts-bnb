# 🧾 RECEIPTS: every crypto call gets a receipt

**Paste any crypto price call. RECEIPTS prices it against live prediction markets (Cournot Intelligence Oracle), adds live CoinMarketCap context, tells you what to do, and anchors a permanent, tamper-proof receipt on BNB Chain, tied to whoever made the call.**

> Built at **BNB Bangkok 2026** · Developer Track (on-chain AI agents) · CoinMarketCap × Atlas Challenge · Cournot Intelligence Oracle

- **Live app:** https://receipts-bnb.vercel.app
- **Diamond (BSC Testnet, chainId 97):** [`0xcAe4378872F3072A11489A69Fe075681701aed0B`](https://testnet.bscscan.com/address/0xcAe4378872F3072A11489A69Fe075681701aed0B) · source verified ([Sourcify, exact match](https://repo.sourcify.dev/97/0xcAe4378872F3072A11489A69Fe075681701aed0B))
- **Demo video (≤3 min):** _add link_

---

## The problem

Crypto runs on unaccountable price calls. "BNB to $1,000 by January" gets posted, liked and forgotten. If it misses, it's deleted. If it hits, it's pinned. Retail can't tell a 60% call from a 4% long shot, and **nobody keeps score**.

## What RECEIPTS does

1. **Paste the call** and who made it. No wallet, no sign-up, no gas.
2. **Price it.** Cournot's Intelligence Oracle matches the call to a live prediction market and returns a **probability with sourced evidence** (Kalshi prices, Binance futures, cross-venue data, model forecasts).
3. **Contextualise it.** Live **CoinMarketCap** price, momentum, volume and Fear & Greed turn the odds into an **action and position-sizing guidance**.
4. **Receipt it.** Claim, caller, odds, verdict, CMC snapshot and the **full Cournot evidence** are anchored on BNB Chain in an **EIP-2535 Diamond**. Anyone can verify any receipt byte-for-byte in their browser.
5. **Keep score.** Every caller builds a public record: average odds of their calls, hits and misses, and an on-chain **alpha score** that only rewards beating the market.

**Who it's for:** retail traders deciding whether to follow a call; communities and DAOs that want a neutral record of their KOLs; journalists and researchers tracking hype.

## Pages

| Route | What it is |
|---|---|
| `/` | Landing: live CMC ticker, on-chain stats, latest receipts, Fear & Greed gauge |
| `/check` | The checker: 4-step animated pipeline → receipt prints → verdict, evidence, CMC panel, chain proof, share to X |
| `/ledger` | Public ledger read straight from the Diamond, filterable by verdict, paginated |
| `/r/[id]` | Receipt page: Cournot evidence, our analysis (labelled), **in-browser keccak256 verification** against chain state |
| `/hall` | Hall of Hype: callers ranked by delusion (avg odds), alpha, or volume |
| `/caller/[handle]` | Caller record: stats, verdict mix, all receipts |
| `/how` | Architecture: renders the Diamond's **live loupe** (facets → selectors) plus the trust and cost model |

---

## Architecture

```
Browser ──▶ Next.js /api/cournot/* proxy ──▶ Cournot /resolve + /probability
                 │ memo · partner key · IP redaction
                 ▼
Next.js /api/anchor ──▶ re-verifies market on Cournot ──▶ CoinMarketCap snapshot (server-side key, cached)
   │
   ▼  relayer (gas-sponsored)            or   anyone, via EIP-712 anchorWithSig
RECEIPTS Diamond (EIP-2535) on BSC ──▶ evidence JSON in event log + keccak256 in state
```

### Smart contracts: EIP-2535 Diamond (`contracts/`)

One permanent address, upgradeable facets, **namespaced diamond storage** (`keccak256("receipts.ledger.storage.v1")`), so facets can be replaced without migrating a receipt.

| Facet | Responsibility |
|---|---|
| `DiamondCutFacet` | Owner-gated `diamondCut` (add / replace / remove) |
| `DiamondLoupeFacet` | EIP-2535 loupe + ERC-165 |
| `OwnershipFacet` | ERC-173 |
| `ReceiptFacet` | `anchor`, `anchorBatch`, **`anchorWithSig`** (permissionless EIP-712 path), `anchorDigest` |
| `SettlementFacet` | `settle`, `settleMarket` (bounded batch), updates **alpha** |
| `LedgerFacet` | Paged reads, per-caller / per-market indexes, `verifyEvidence` |
| `AdminFacet` | Attester registry, circuit breaker (`setPaused`), `nonces`, `DOMAIN_SEPARATOR` |
| `ReceiptsInit` | One-shot initializer (interfaces, attesters, cached EIP-712 domain) |

**Design details**

- **The verdict is enforced on-chain** (`LibReceipts.verdictFor`): ≥65% LIKELY · 35–65% COIN FLIP · 10–35% UNLIKELY · <10% DELUSIONAL. Nobody can relabel a call after the fact.
- **Tamper-evident evidence.** The full Cournot JSON is emitted in `ReceiptAnchored`, and its `keccak256` is stored. `blockNumber` is stored, so the log is fetched with a single-block `getLogs`.
- **Permissionless submission.** `anchorWithSig` accepts an attester-signed EIP-712 `Anchor` payload from **any** wallet. It has per-attester nonces (replay protection), deadlines, and a malleability-safe `ecrecover` (rejects high-s and bad v). The relayer is a convenience, not a gatekeeper.
- **Market-relative alpha.** HIT → `+(10000 − p)`, MISS → `−p`. A caller who only repeats consensus converges to 0. Positive alpha means you were right when the market thought you were wrong.
- **Input bounds** (claim ≤ 280 B, handle ≤ 32 B, evidence ≤ 16 KB), custom errors throughout, and a bounded `settleMarket(maxCount)`.

**Deployed facets (BSC Testnet):**

| Contract | Address |
|---|---|
| **Diamond** | `0xcAe4378872F3072A11489A69Fe075681701aed0B` |
| DiamondCutFacet | `0x822BC44CeAb1cbc03182C45107908d4676c802E2` |
| DiamondLoupeFacet | `0x9007D250e798aED178040a4e27b76797ba329153` |
| OwnershipFacet | `0x3eEd5cE4DE7CfB5f241799DE96F598F4837366DE` |
| ReceiptFacet | `0xaC2CDDA4CE743b98A0b46CE79149AeddE16DBa18` |
| SettlementFacet | `0xEDB26A4C5C4a151ddF77f1Eb87Dd648e5c7B52c7` |
| LedgerFacet | `0x84886Cd155801F0757418d3c66dA7c5c793Cd36d` |
| AdminFacet | `0x4134425e3F904599Ac50305dd5107A8eD55D5095` |
| ReceiptsInit | `0x4d7C4DE4Fd8849041f881E3552Ad98aea65291AB` |

First receipts: [#0](https://testnet.bscscan.com/tx/0x81d51e13a04954466c11a85659741a2a167d0191f13babee045e273277ee95ad) and [#1](https://testnet.bscscan.com/tx/0xe7abd8273b4459a93580965b1cb60e38e2bed4a7a5a8b6026e8b2ae2acbaa072).

**Tests:** `cd contracts && forge test`. **21 tests**, including fuzzing, cover: loupe and ERC-165, unknown selectors, re-init guard, **upgrade keeps receipts** (replace with `LedgerFacetV2`), function removal, owner-only cuts, anchoring and indexes, batch, attester and pause guards, input validation, **EIP-712 permissionless submit / replay / expiry / wrong signer / tampered payload**, alpha math, settle timing and double-settle, `settleMarket`, and a fuzzed verdict-threshold invariant.

### Zero-cost by design

- **One oracle query serves many users.** Cournot rejects browser-originated calls, so a thin server proxy (`/api/cournot/*`) memoises answers for 10 minutes and supports a server-side partner key (`COURNOT_API_KEY`) or a user-supplied key (forwarded per request, never stored).
- **The chain is the cache.** If anyone checked the same market in the last 6 hours, `/api/cache` serves that anchored, verifiable answer.
- **CoinMarketCap** runs server-side only, with in-memory and ISR caching to stay inside the free Basic plan.
- **BSC testnet gas** is ~0.1 gwei. A receipt costs ~0.00004 tBNB, sponsored by the relayer.

### Privacy and safety

- Cournot echoes the caller's IP in `free_quota.ip`. **RECEIPTS strips it (client and server) before anything is hashed or anchored.**
- API keys and the relayer key live in server env only (never in the front end or the repo).
- The server validates the Cournot response shape and **independently re-verifies the market id via Cournot's free `/resolve`** before anchoring.
- Per-IP rate limiting and a serialized relayer queue (no nonce collisions).
- UI copy: *an assessment of prediction-market pricing, not investment advice.*

---

## Cournot Integration

**What the project is.** A public ledger that prices crypto price calls with Cournot and records them on BNB Chain.

**Where and how it calls Cournot** (`web/src/lib/cournot.ts`, invoked from `web/src/components/CheckFlow.tsx`):

1. `POST https://interface.cournot.ai/intelligence/v1/resolve` with `{ message: <the call>, limit: 5 }` → candidate markets with `matching_confidence`. The top match is used, and the alternatives are shown so the user can switch.
2. `POST https://interface.cournot.ai/intelligence/v1/probability` with `{ message, market_ids: [id] }`. Both calls go through our proxy (`web/src/app/api/cournot/*`), because Cournot rejects browser-originated requests. The proxy adds `COURNOT-API-KEY` (server env, or a user key forwarded per request), redacts `free_quota.ip`, and memoises the response.
3. Server-side integrity check: `web/src/app/api/anchor/route.ts` re-calls `/resolve` with the market title and confirms the market id exists before anchoring.

**How the probability is used.** `data.probability` → basis points → **the on-chain verdict** (`LibReceipts.verdictFor`) → the action ("Do not follow this call", "Half size at most", …) and position-sizing guidance → the caller's **average odds** and, once resolved, their **alpha score**. Nothing is mocked or hardcoded. If Cournot is unreachable or the quota is exhausted with no fresh on-chain cache, **no receipt is created**.

**Where users see the claim and evidence.**
- `/check`: the panel "Claim evaluated by Cournot" shows the market title and id, the probability, the end time, and every `basis` item (source, summary, time, link). The panel "What to do about it" is explicitly badged **"ADDED BY RECEIPTS · NOT FROM COURNOT"**.
- `/r/[id]`: the same evidence, re-read from the on-chain event log and verifiable in the browser.

**Proof of a successful call.** See [`proof/`](proof/):
- `proof/cournot-probability-response.json`: a live `/probability` response for market **#112834** ("BNB price above $685.00 at 2026-11-27 22:00 UTC") → `probability: 0.04`, with Kalshi, Binance, venues and forecast basis (IP redacted).
- `proof/cournot-probability-headers.txt`: response headers, including the Cournot `x-trace-id` request id.
- On-chain: every receipt's `evidenceHash` is the keccak256 of a real Cournot response, retrievable from its anchoring transaction.

---

## CoinMarketCap Integration

| Endpoint | Used for |
|---|---|
| `GET /v2/cryptocurrency/quotes/latest` | Spot price, 1h/24h/7d change, volume, market cap, rank. **Spot price is written into every receipt** (`spotPriceE8`). Also feeds the live ticker. |
| `GET /v3/fear-and-greed/latest` | Market mood. **Written into every receipt** (`fearGreed`) and used in the verdict context and the gauge. |
| `GET /v1/global-metrics/quotes/latest` | BTC dominance and total market cap for context. |

Calls are server-side (`web/src/lib/cmc.ts`), keyed via `X-CMC_PRO_API_KEY` from env, and cached in memory and via ISR. Usage is verifiable through CMC API logs for the team key and through on-chain reads of `spotPriceE8` / `fearGreed`.

---

## Run it

```bash
# contracts
cd contracts
forge test
forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC --private-key $RELAYER_PRIVATE_KEY --broadcast

# web
cd web
cp .env.example .env.local   # fill CMC_API_KEY, RELAYER_PRIVATE_KEY, NEXT_PUBLIC_REGISTRY_ADDRESS
npm install && npm run dev
```

## Next steps

- Auto-settlement keeper: poll Cournot market outcomes and call `settleMarket`.
- "Self-anchor" button: the server returns an EIP-712 signature and the user lands it with their own wallet.
- Browser extension: a "Check odds" button next to price calls on X and Telegram.
- Caller pages with OG images; an embeddable "receipt" widget for communities.
- Mainnet deployment.
