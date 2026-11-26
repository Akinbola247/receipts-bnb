# RECEIPTS: one-page write-up (CoinMarketCap × Atlas Challenge)

**Live app:** https://receipts-bnb.vercel.app · **Repo:** https://github.com/Akinbola247/receipts-bnb

**Team:** Akinbola Kehinde

## Problem and audience
Crypto price calls ("BNB to $1,000 by January") move retail money but are never priced or tracked. **RECEIPTS** is a risk tool for anyone about to act on a call:
- **Retail traders:** "should I follow this?"
- **Communities and DAOs:** a neutral, permanent record of their KOLs.
- **Researchers and journalists:** a public dataset of hype versus outcomes.

Paste a call. RECEIPTS returns the market-implied probability (Cournot), live market context (CoinMarketCap), a clear action with position sizing, and anchors a tamper-proof receipt on BNB Chain.

## Data used and why
| Source | Endpoint | Why |
|---|---|---|
| CoinMarketCap | `/v2/cryptocurrency/quotes/latest` | Spot price and 1h/24h/7d momentum, volume, market cap. Spot is **stored on-chain in every receipt**, so later outcomes are judged against the price at call time. Momentum and volatility drive position sizing. |
| CoinMarketCap | `/v3/fear-and-greed/latest` | Sentiment distorts calls (moonshots get loud in fear and in euphoria). **Stored on-chain** and used in the guidance. |
| CoinMarketCap | `/v1/global-metrics/quotes/latest` | BTC dominance and total market cap for macro context. |
| Cournot Intelligence Oracle | `/resolve`, `/probability` | Converts a free-text call into a live prediction market and a probability with sourced evidence. |
| Atlas | not used (no public BSC feed addresses were available without onboarding) | `LedgerFacet` can be extended via a `diamondCut` to read an Atlas push feed (Chainlink-compatible `latestRoundData`) for on-chain settlement prices. |

Keys stay server-side and responses are cached (free Basic plan). Usage is verifiable via CMC API logs and on-chain reads of `spotPriceE8` / `fearGreed`.

## BNB Chain
- **Network:** BSC Testnet (chainId 97)
- **RECEIPTS Diamond (EIP-2535):** `0xcAe4378872F3072A11489A69Fe075681701aed0B` (source verified on Sourcify)
- **Facets:** Cut, Loupe, Ownership, Receipt (incl. EIP-712 `anchorWithSig`), Settlement (market-relative alpha), Ledger, Admin
- **Tests:** 21 Foundry tests, including fuzzing

## RWA angle
Receipts are verifiable **records of real-world market claims**: a timestamped, priced attestation of a public statement, with the oracle evidence hashed on-chain. The same Diamond extends to tokenized-asset claims (gold, treasuries, stocks) as Cournot coverage grows, through a new facet and no migration.

## Next steps
Auto-settlement keeper → caller alpha leaderboards; self-anchor with your own wallet (EIP-712 already on-chain); browser extension next to calls on X and Telegram; Atlas feed facet for on-chain settlement prices; mainnet.
