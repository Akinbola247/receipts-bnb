# 🧾 RECEIPTS: every crypto call gets a receipt

**Fact-check any crypto price call against live prediction-market odds, then anchor a permanent, tamper-proof receipt on BNB Chain, tied to whoever made the call.**

| | |
|---|---|
| **Live app** | https://receipts-bnb.vercel.app |
| **Repository** | https://github.com/Akinbola247/receipts-bnb (README has setup instructions) |
| **Demo video (2:33)** | _add link_ |
| **Network** | BNB Smart Chain Testnet (chainId 97) |
| **RECEIPTS Diamond** | [`0xcAe4378872F3072A11489A69Fe075681701aed0B`](https://testnet.bscscan.com/address/0xcAe4378872F3072A11489A69Fe075681701aed0B), source-verified on [Sourcify](https://repo.sourcify.dev/97/0xcAe4378872F3072A11489A69Fe075681701aed0B) (exact match) |
| **Tracks entered** | Developer Track (Build on BNB Chain) · CoinMarketCap × Atlas Challenge · Cournot Intelligence Oracle |
| **Team** | Akinbola Kehinde (builder) · contact: _add email / Telegram / X_ |

---

## Part 1: One-page summary

### The problem
Crypto runs on price calls ("BNB to $1,000 by January", "BTC $250k this year"). They move retail money, yet **nobody prices them and nobody keeps score**. Misses get deleted and hits get pinned. A retail trader can't tell a 60% call from a 1% long shot, and prediction markets already know the difference.

### Who it's for
- **Retail traders** deciding whether to act on a call: *"should I follow this?"*
- **Communities, DAOs and exchanges** that want a neutral, permanent record of the KOLs and analysts their users follow.
- **Journalists and researchers** who need a verifiable dataset of public predictions versus outcomes.

### What RECEIPTS does
1. **Paste a call** (or an X post link). No wallet, no gas, no sign-up.
2. **Cournot Intelligence Oracle** matches it to a live prediction market and returns a **probability with sourced evidence**.
3. **CoinMarketCap Pro API** adds live price, momentum, volume and Fear & Greed.
4. RECEIPTS turns that into an **action and position-sizing guidance** (LIKELY / COIN FLIP / UNLIKELY / DELUSIONAL).
5. A **receipt** is anchored on BNB Chain in an **EIP-2535 Diamond**. It stores the claim, the caller, the odds, the verdict, the CMC snapshot, the full oracle evidence (in the event log, hash in state) and a **link to the original post**.
6. Every caller accumulates a public record: average odds of their calls, hits and misses, and an on-chain **market-relative alpha score**.

### Data used and why
| Source | Endpoint / feed | Why it is in the core product |
|---|---|---|
| **CoinMarketCap** | `GET /v2/cryptocurrency/quotes/latest` | Spot price, 1h/24h/7d change, volume, market cap, rank for the call's asset. **Spot price is written on-chain into every receipt** (`spotPriceE8`). Momentum and volatility drive position sizing. Also feeds the live ticker. |
| **CoinMarketCap** | `GET /v3/fear-and-greed/latest` | Sentiment distorts calls: moonshots get loudest in fear and in euphoria. **Written on-chain into every receipt** (`fearGreed`). Drives verdict context and the gauge. |
| **CoinMarketCap** | `GET /v1/global-metrics/quotes/latest` | BTC dominance and total market cap for macro context. |
| **Cournot** | `POST /intelligence/v1/resolve`, `POST /intelligence/v1/probability` | Turns a free-text call into a priced prediction market, with evidence (Polymarket, Kalshi, Binance futures, cross-venue data, model forecasts). The probability **is** the verdict. |
| **BNB Chain** | RECEIPTS Diamond (8 facets) | Permanent, public, verifiable ledger, plus provenance, settlement and reputation. |
| Atlas | not integrated (see 3.3) | No public BSC feed addresses or API key without onboarding. The Diamond can add an Atlas feed facet later without migrating any data. |

### BNB Chain contracts (testnet)
Diamond `0xcAe4378872F3072A11489A69Fe075681701aed0B`. Facets: Cut `0x822B…02E2`, Loupe `0x9007…9153`, Ownership `0x3eEd…66DE`, Receipt `0xaC2C…Ba18`, Settlement `0xEDB2…52c7`, Ledger `0x8488…d36d`, Admin `0x4134…5095`, **Source (live upgrade)** `0x21EC…3248`. Full addresses are in §4.2.

### What we'd build next
An auto-settlement keeper (Cournot resolution → `settleMarket` → live alpha leaderboards), a browser extension that shows the odds next to any call on X or Telegram, self-anchoring with your own wallet (the EIP-712 path is already on-chain), an Atlas feed facet for on-chain settlement prices, RWA claims (tokenized gold, treasuries, equities) as oracle coverage grows, and mainnet.

---

## Part 2: The product in detail

### 2.1 Pages
| Route | What the user does there |
|---|---|
| `/` | Landing: live CMC ticker, on-chain stats, fresh receipts, Fear & Greed gauge |
| `/check` | **Type any call** or **paste an X post link** (imports the text, author, date and link). A 4-step animated pipeline runs, a receipt "prints" and gets stamped, and panels show the verdict, the Cournot claim and evidence, our labelled analysis, CMC data and the on-chain proof. Share to X |
| `/ledger` | Every receipt, newest first. Filter by verdict or "with original post". Paginated |
| `/r/[id]` | One receipt: original post link and date, Cournot evidence read back from the chain, **in-browser keccak256 verification** against on-chain state, links to the in-app explorer and BscScan |
| `/hall` | Hall of Hype: callers ranked by delusion (average odds), alpha, or volume |
| `/caller/[handle]` | A caller's record: stats, verdict mix, every receipt |
| `/explorer` | **On-chain explorer**: every Diamond event decoded (receipts, source links, settlements, facet cuts, attester changes), upgrade timeline, relayer gas balance |
| `/explorer/tx/[hash]` | Decoded transaction: method, arguments, gas and fee, events, link to the receipt |
| `/how` | Architecture: the Diamond's **live loupe** (facets → selectors), the intake pipeline, and the trust and cost model |

### 2.2 How a call becomes a receipt
```
call text (+ @author, original-post URL, post date)      ← typed, or imported from an x.com link
   │
   ▼  /api/cournot/resolve   → candidate markets
   ▼  matchMarket()           → exact | upper bound | refuse     (asset, target, direction, deadline)
   ▼  /api/cournot/probability → p + basis (evidence); IP redacted; memoised
   │     └─ on HTTP 402 (quota): reuse an answer anchored on-chain in the last 6h (the chain is the cache)
   ▼  /api/market             → CoinMarketCap snapshot (server-side key, cached)
   ▼  /api/anchor             → validates the response, re-verifies the market on Cournot,
   │                            re-runs matchMarket, normalises the handle, checks the https source
   ▼  SourceFacet.anchorWithSource(...)  (relayer pays gas, ~0.00004 tBNB)
   ▼  ReceiptAnchored + SourceLinked events  → ledger, caller record, explorer
```

### 2.3 Honest matching: the core differentiator
A prediction market prices **one specific event** ("STRK above $0.30 before 2027"). A call is often a **different** event ("STRK to $5 by December"). A naive integration takes the top search hit and would price that $5 call at the odds of "STRK > $0.10", stamping it LIKELY. RECEIPTS refuses to do that. `web/src/lib/match.ts` (shared by browser and server, enforced again in `/api/anchor`) parses the call's **asset, price target, direction and deadline** (`by December`, `end of 2027`, `mid-2027`, `this year`, `before 2027`, …):

| Situation | Result |
|---|---|
| Same asset and direction, threshold within ±2%, deadline within ±45 days | **Exact**: the market's probability is the call's probability |
| An *easier* market: lower target for a bullish call, longer window, or "touch at any time" versus a year-end close | **Upper bound**: shown as **≤ p**, and labelled as such |
| The market closes **before** the call's deadline, a different asset, or nothing bounds it | **Refused**: no receipt, and the closest markets are shown as "not the same call" |

Live examples from the demo:
- Tom Lee's *"Bitcoin will close above $100,000 at the end of 2026"* gets **≤1.4%**, an upper bound because the market pays on a touch at any time.
- *"STRK to $5 by December"* gets **≤ p of the $0.30 market**.
- Brian Armstrong's *"$1M BTC by 2030"*, imported from his X post, is **refused** because every live market closes before 2030.

### 2.4 How calls get in (and stay honest)
1. **Anyone, at `/check`**: type the call, author, original-post URL and date, or paste an X link to import them.
2. **Curated batch import**: `scripts/seed-calls.mjs` runs `data/real-calls.json` (26 verified public calls from Standard Chartered, Bernstein, Citi, Galaxy, Tom Lee, Arthur Hayes, Kiyosaki, Garlinghouse, VanEck, ARK, Coinbase, Bitwise and Saylor, each with a source URL and post date) through the **same** pipeline. Calls without a defensible market are skipped and logged. Negated calls ("won't reach X") are excluded until we support inversion, and institutions get non-X labels (`@bernstein.research`) so we never imply someone else's account.
3. **Permissionless, on-chain**: any wallet can land an attester-signed EIP-712 receipt (`anchorWithSig`).

**State at submission:** 12 receipts, 8 callers, 6 with on-chain provenance links. Two of these were created by other people trying the live app (#9 `@anon`, #10 `@alexmasoncrypto` with an X link). The remaining 16 curated calls are ready and waiting on Cournot quota (Part 6).

---

## Part 3: Data integrations in depth

### 3.1 CoinMarketCap Pro API (CoinMarketCap × Atlas Challenge)
- **Code:** `web/src/lib/cmc.ts` (server-only), exposed through `/api/market`, used by `/api/anchor` and the ticker.
- **Core feature, not decoration.** Every receipt is anchored with the CMC spot price (`uint128 spotPriceE8`) and Fear & Greed (`uint8 fearGreed`) **at the moment of the call check**. This makes later outcome judging and "the price when they said it" verifiable on-chain forever.
- **Decisions it drives:** position sizing and context notes. Extreme fear or greed, a 7-day move above ±8% and 24h volatility above ±4% all change the guidance shown next to the verdict.
- **Asset coverage:** 40+ tickers and names plus cashtags (`$STRK`) map to CMC symbols. Unknown tickers are queried directly.
- **Safety and cost:** the key lives only in server env (`X-CMC_PRO_API_KEY`), never in the browser or the repo. There's an in-memory memo plus ISR caching (quotes 60s, F&G 10min, global 5min), so traffic stays within the free Basic plan (15k credits a month, 50 requests a minute).
- **Verifiable usage:** CMC API logs tied to the team key, plus on-chain reads of `spotPriceE8` and `fearGreed` on every receipt (`LedgerFacet.getReceipt(id)`).

### 3.2 Cournot Intelligence Oracle (Cournot track)
- **Calls:** `POST https://interface.cournot.ai/intelligence/v1/resolve` and `POST …/probability`. These are **the same base URL, paths and `COURNOT-API-KEY` header as the official Skill's client** (`cournot-skills/skills/cournot/scripts/cournot-client.mjs`). Cournot rejects browser-originated requests, so the browser calls our thin proxy (`web/src/app/api/cournot/*`), which forwards them.
- **Probability → decision:** `data.probability` goes to basis points, then to the **on-chain verdict** (`LibReceipts.verdictFor`: ≥65% LIKELY, 35–65% COIN FLIP, 10–35% UNLIKELY, <10% DELUSIONAL), then to an action ("Do not follow this call") and sizing ("No position; protect downside"). It also feeds the caller's average odds and, after settlement, their alpha. **Nothing is mocked:** if Cournot is unavailable and no fresh on-chain answer exists, no receipt is created.
- **Claim and evidence shown:** the `/check` panel "Claim evaluated by Cournot" shows the market title and id, probability, end time, match confidence, the match mode (exact or upper bound) and every `basis` item (source, summary, timestamp, link). The panel "What to do about it" is badged **"ADDED BY RECEIPTS · NOT FROM COURNOT"**. `/r/[id]` re-reads the same evidence from the on-chain event log.
- **Reproducible proof:**
  - `proof/cournot-probability-response.json`: a live `/probability` response for market #112834, with Kalshi, Binance, venue and forecast basis (IP redacted).
  - `proof/cournot-probability-headers.txt`: response headers including Cournot's `x-trace-id`.
  - **Every receipt** stores `keccak256` of the exact Cournot response, and the full JSON is in its anchoring transaction. For example, receipt [#11](https://testnet.bscscan.com/tx/0x560f3e332433e17a82c3e9d88d462b5213a5d3ea8924662a51309cde44b9d259) (Tom Lee) has evidence hash `0x9769270663ead1ea138521b8687e0936af4d4ac2f614e0a611bc69e65cf3ce14`. Anyone can recompute it with the "Verify evidence in my browser" button.
- **Cost model:** answers are memoised for 10 minutes, and answers anchored in the last 6 hours are reused from the chain. A partner key (`COURNOT_API_KEY`) or a user-supplied key (forwarded per request, never stored) is supported.

### 3.3 Atlas
Atlas push and pull feeds require onboarding for BSC feed addresses and an API key, which we couldn't obtain during the event. We chose not to fake it. The Diamond lets an `AtlasFeedFacet` be added by `diamondCut` without migrating any data. It would read `latestRoundData()` from a push feed to record on-chain settlement prices, and we'd like to do this together with the Atlas team.

---

## Part 4: Smart contracts (Developer Track)

### 4.1 Architecture: EIP-2535 Diamond
One permanent address; logic split into facets; **namespaced diamond storage** (`keccak256("receipts.ledger.storage.v1")`, `keccak256("receipts.sources.storage.v1")`), so any facet can be replaced or added without migrating a single receipt.

| Facet | Responsibility |
|---|---|
| `DiamondCutFacet` | Owner-gated `diamondCut` (add / replace / remove) |
| `DiamondLoupeFacet` | EIP-2535 loupe + ERC-165 |
| `OwnershipFacet` | ERC-173 |
| `ReceiptFacet` | `anchor`, `anchorBatch`, **`anchorWithSig`** (permissionless EIP-712), `anchorDigest` |
| `SettlementFacet` | `settle`, bounded `settleMarket(marketId, yes, maxCount)`; updates alpha |
| `LedgerFacet` | Paged reads, per-caller and per-market indexes, `verifyEvidence` |
| `AdminFacet` | Attester registry, circuit breaker, nonces, `DOMAIN_SEPARATOR` |
| `SourceFacet` | **Added by a live `diamondCut` after launch.** `anchorWithSource`, write-once `linkSource`, `sourceOf` / `sourcesOf` |

### 4.2 Deployed addresses (BSC testnet, chainId 97)
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
| SourceFacet (upgrade 1) | `0x21EC0B60Ba73915c5d2ff8F92F694A2Be9Ff3248`, cut tx [`0x4d2bcc75…68cdcf`](https://testnet.bscscan.com/tx/0x4d2bcc75199025a6c83be34e82e8735839a2d0118687f9d253e7bebb8368cdcf) |
| Relayer / attester / owner | `0x7655DfeE0BF557ed07f165fa53faBC24c62065c5` |

**Example receipts:** [#0](https://testnet.bscscan.com/tx/0x81d51e13a04954466c11a85659741a2a167d0191f13babee045e273277ee95ad) (first receipt), [#5](https://testnet.bscscan.com/tx/0xb422859a684b42131a068a19e85c64c882245b73400d66ca428f52c63369b22d) (Standard Chartered, sourced), [#11](https://testnet.bscscan.com/tx/0x560f3e332433e17a82c3e9d88d462b5213a5d3ea8924662a51309cde44b9d259) (Tom Lee, sourced, upper bound). The in-app explorer at `/explorer` decodes all of them.

### 4.3 What a receipt stores on-chain
`marketId`, `probabilityBps`, `verdict` (derived **on-chain**, so nobody can relabel a call after the fact), `outcome`, `fearGreed` (CMC), `createdAt`, `blockNumber` (for single-block log retrieval), `resolvesAt`, `spotPriceE8` (CMC), `attester`, `callerHash`, `evidenceHash` (keccak of the Cournot JSON), `caller`, `asset`, `claim`. The full evidence JSON is emitted in `ReceiptAnchored`. Provenance (`url`, `postedAt`, `linkedBy`) lives in `SourceFacet` storage and is emitted in `SourceLinked`.

### 4.4 Design details judges may care about
- **Market-relative alpha:** HIT adds `10000 − p` and MISS subtracts `p`. Repeating consensus converges to 0; only being right when the market disagreed builds reputation.
- **EIP-712 permissionless path:** `anchorWithSig` has per-attester nonces (replay protection), deadlines, and a malleability-safe `ecrecover` (rejects high-s and bad v). The relayer is a convenience, not a gatekeeper.
- **Write-once provenance:** https-only URLs, length bounds, no future post dates, and a source can't be swapped once linked.
- **Bounded loops** (`settleMarket(maxCount)`), input bounds (claim ≤ 280 B, handle ≤ 32 B, evidence ≤ 16 KB) and custom errors throughout.
- **Gas:** ~390k gas per receipt including evidence, which is about **0.00004 tBNB** at 0.1 gwei. The whole Diamond deploy cost ~0.00036 tBNB.

### 4.5 Tests and verification
`forge test`: **25 passing**. 21 core tests:
- loupe and ERC-165, unknown selectors, re-init guard;
- an upgrade that keeps receipts (`LedgerFacetV2`), function removal, owner-only cuts;
- anchoring and indexes, batch, attester and pause guards, input validation;
- EIP-712 submit, replay, expiry, wrong signer and tampered payload;
- alpha math, settle timing and double-settle, `settleMarket`;
- a fuzzed verdict-threshold invariant.

4 SourceFacet tests: upgrade with existing receipts, atomic anchor+source, write-once backfill, and URL, date and permission guards. All facets are submitted to Sourcify, and the Diamond is an exact match.

---

## Part 5: Safety and privacy
- **No keys in the front end or repo:** the CMC key, the relayer key and the Cournot key are server env only. The full git history has been scanned clean.
- **IP redaction:** Cournot echoes the caller's IP (`free_quota.ip`). It's stripped on both client and server **before** hashing or anchoring, so no personal data goes on-chain.
- **Server-side validation:** the Cournot response shape is checked, the market is independently re-verified on Cournot, the claim↔market match is re-run, handles are normalised and the source must be https.
- **Abuse controls:** per-IP rate limiting on anchoring, a serialized relayer queue (no nonce collisions), a contract circuit breaker (`setPaused`), and an attester allow-list.
- **Resilience:** a multi-RPC fallback. The official BNB testnet RPC rejects `eth_getLogs`, so log-capable endpoints come first.
- **Disclaimers:** the UI states it is "an assessment of prediction-market pricing, not investment advice".

---

## Part 6: Honest limitations
- **Oracle coverage:** Cournot's first release covers crypto price events. Calls without a live market are refused by design.
- **Quota:** without a partner key, the public app shares Cournot's free quota (3 calls per IP). The on-chain cache softens this; a `COURNOT_API_KEY` removes it.
- **Trust in the attester:** receipts are attested by our relayer. Evidence is hash-committed and publicly verifiable, and `anchorWithSig` lets other attesters and submitters participate. Multi-attester quorum is on the roadmap.
- **Settlement** is attester-triggered today. An automated keeper is next.
- **Testnet only.** The architecture is mainnet-ready.

---

## Part 7: How this maps to the judging criteria

### CoinMarketCap × Atlas (100)
| Criterion | Evidence |
|---|---|
| Depth of data integration (25) | Three live CMC endpoints in the core flow. Spot and F&G are persisted **on-chain** per receipt. Momentum and volatility drive the guidance. Asset detection covers 40+ assets |
| Real-world potential (25) | A daily pain point (KOL calls), a no-wallet UX, shareable receipts, and a public reputation layer for analysts and communities |
| BNB Chain and RWA focus (20) | Deployed and verified on BSC. Receipts are on-chain attestations of real-world public statements. A path to RWA claims and an Atlas facet without migration |
| Technical quality and safety (15) | EIP-2535 Diamond, 25 tests, EIP-712, server-only keys, IP redaction, validation and rate limits |
| Originality (10) | Prediction-market odds plus an on-chain receipt ledger plus honest bound-or-refuse matching |
| Demo and presentation (5) | A 2:33 narrated video, recorded live against the deployed app |

### Cournot (pass/fail, then 100)
- ✅ Live calls, with proof in `proof/` and an evidence hash on every receipt.
- ✅ The probability is displayed and drives the on-chain verdict, the action and the sizing. It is never mocked.
- ✅ The exact claim (market title) and every evidence item are shown, and our own analysis is clearly badged.
- **Integration depth (35):** resolve plus probability, claim↔market matching with upper bounds, evidence committed on-chain and verifiable in the browser, shared on-chain cache.
- **Product potential (25), innovation (20), execution and UX (20):** see Parts 2–5 and the demo.

### Developer Track
Built on BNB Chain, on the **on-chain AI agents** theme: an autonomous pipeline that prices claims with an AI intelligence oracle and writes attested, verifiable judgements on-chain. Its **RWA** relevance is that receipts are on-chain records of real-world statements, and the Diamond extends to tokenized-asset claims.

---

## Part 8: Roadmap
1. **Auto-settlement keeper**: Cournot resolution → `settleMarket` → live alpha leaderboards.
2. **Browser extension and X bot**: show the odds next to any call, or reply "@receipts check this".
3. **Self-anchor** with your own wallet (the EIP-712 path is live), plus multi-attester quorum.
4. **Atlas feed facet** for on-chain settlement prices, and **RWA claims** (gold, treasuries, equities) as coverage grows.
5. **Negated and range calls** ("won't break $X", "between $X and $Y") via market inversion.
6. **Embeddable receipt widgets and OG cards** for communities, then **mainnet**.

---

## Appendix: run it yourself
```bash
git clone https://github.com/Akinbola247/receipts-bnb && cd receipts-bnb
cd contracts && forge test                     # 25 tests
cd ../web && cp .env.example .env.local        # CMC_API_KEY, RELAYER_PRIVATE_KEY, optional COURNOT_API_KEY
npm install && npm run dev                     # http://localhost:3000
# batch-import verified public calls through the live pipeline:
BASE=https://receipts-bnb.vercel.app node scripts/seed-calls.mjs data/real-calls.json --dry
```
