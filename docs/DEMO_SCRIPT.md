# RECEIPTS: demo script (≤ 3:00)

> Record at 1440p. Open tabs in advance: the app home, `/check`, a BscScan tab on the Diamond, and the terminal with `forge test`.
> **Backup:** record one full `/check` run in advance in case Cournot is slow live (Cournot asks for a backup recording).

**0:00–0:20 · Hook (home page)**
"Every day, crypto influencers post price targets. If they miss, they delete them. If they hit, they pin them. Nobody keeps score. RECEIPTS does." Scroll past the live CoinMarketCap ticker and the floating receipt.

**0:20–1:20 · Live check (`/check`)**
- Paste: *"BNB will be above $700 before December 1st"* by `@moonboy_bnb`, then click **Check the odds**.
- Narrate the 4-step pipeline as it lights up:
  1. "Cournot matches a live prediction market."
  2. "The Intelligence Oracle returns the probability, called straight from my browser so each user spends their own free quota."
  3. "CoinMarketCap gives live price, momentum and Fear & Greed."
  4. "And it's anchored on BNB Chain, gas sponsored."
- The receipt prints and the **stamp slams**. Read the verdict and odds.
- Scroll the panels:
  - "Here's the exact claim Cournot evaluated and its evidence: Kalshi, Binance futures, cross-venue data."
  - "This panel is our analysis, clearly labelled: action and position sizing."
  - "Live CMC data."
  - "And the transaction."

**1:20–1:50 · Verify (`/r/[id]`)**
Open the receipt page and click **Verify evidence in my browser** → ✔ MATCH. "The full oracle response lives in the transaction log. Change one byte and verification fails. Don't trust us, verify." Click through to BscScan.

**1:50–2:20 · Accountability (`/hall`, `/caller/...`)**
"Every caller gets a permanent record: average odds of their calls, hits and misses, and an on-chain alpha score. Hitting a 4% call earns +96. Missing an 80% call costs −80. Repeating consensus scores zero, so only real alpha counts."

**2:20–2:50 · Architecture (`/how` + terminal)**
"Under the hood it's an EIP-2535 Diamond. This table is read live from the loupe: seven facets, one permanent address, namespaced storage, so we upgrade without migrating a receipt. Anyone can submit receipts through EIP-712 signatures, with replay and malleability protection. 21 Foundry tests, including fuzzing." Show `forge test` passing.

**2:50–3:00 · Close**
"RECEIPTS. Every crypto call gets a receipt. Live on BNB Chain."
