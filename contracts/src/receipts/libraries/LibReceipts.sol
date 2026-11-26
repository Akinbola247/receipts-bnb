// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LibReceipts — namespaced (EIP-2535 "diamond storage") state + core logic for the RECEIPTS ledger.
/// @dev   Every facet reads/writes this single Layout at a fixed, collision-free slot, so facets can be
///        replaced independently without any storage migration.
library LibReceipts {
    bytes32 internal constant STORAGE_POSITION = keccak256("receipts.ledger.storage.v1");

    bytes32 internal constant ANCHOR_TYPEHASH = keccak256(
        "Anchor(uint64 marketId,uint16 probabilityBps,uint8 fearGreed,uint64 resolvesAt,uint128 spotPriceE8,string caller,string asset,string claim,bytes32 evidenceHash,uint256 nonce,uint256 deadline)"
    );
    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant NAME_HASH = keccak256("RECEIPTS");
    bytes32 internal constant VERSION_HASH = keccak256("1");

    uint16 internal constant BPS = 10_000;
    uint256 internal constant MAX_CLAIM_BYTES = 280;
    uint256 internal constant MAX_CALLER_BYTES = 32;
    uint256 internal constant MAX_EVIDENCE_BYTES = 16_000;

    // ───────────── types ─────────────

    enum Verdict {
        LIKELY, // p >= 65%
        COIN_FLIP, // 35% <= p < 65%
        UNLIKELY, // 10% <= p < 35%
        DELUSIONAL // p < 10%
    }

    enum Outcome {
        PENDING,
        HIT,
        MISS
    }

    struct Receipt {
        uint64 marketId; // Cournot market id
        uint16 probabilityBps; // market-implied probability of the claim (0..10000)
        Verdict verdict; // derived on-chain from probabilityBps
        Outcome outcome;
        uint8 fearGreed; // CoinMarketCap Fear & Greed at anchor time
        uint64 createdAt;
        uint64 blockNumber; // block holding the evidence log (cheap targeted getLogs)
        uint64 resolvesAt; // market end time
        uint128 spotPriceE8; // CoinMarketCap spot price, 8 decimals
        address attester; // who vouched for the oracle response
        bytes32 callerHash; // keccak256(normalised handle)
        bytes32 evidenceHash; // keccak256(raw Cournot response JSON)
        string caller;
        string asset;
        string claim;
    }

    /// @dev alphaBps is a market-relative reputation score. For each settled call:
    ///      HIT  → +(10000 - p)   (you beat the market by exactly how unlikely it thought you were)
    ///      MISS → -p             (you lose what the market already priced in)
    ///      A perfectly calibrated "follow the market" caller converges to 0. Positive = real alpha.
    struct CallerStats {
        uint32 calls;
        uint32 hits;
        uint32 misses;
        uint64 sumProbabilityBps;
        int64 alphaBps;
    }

    struct AnchorInput {
        uint64 marketId;
        uint16 probabilityBps;
        uint8 fearGreed;
        uint64 resolvesAt;
        uint128 spotPriceE8;
        string caller;
        string asset;
        string claim;
        string evidenceJson;
    }

    struct Layout {
        Receipt[] receipts;
        mapping(bytes32 => CallerStats) callerStats;
        mapping(bytes32 => uint256[]) byCaller;
        bytes32[] callers;
        mapping(uint64 => uint256[]) byMarket;
        mapping(address => bool) attesters;
        mapping(address => uint256) nonces;
        bool paused;
        bool initialized;
        bytes32 cachedDomainSeparator;
        uint256 cachedChainId;
    }

    // ───────────── errors / events ─────────────

    error NotAttester(address account);
    error LedgerPaused();
    error BadProbability(uint16 bps);
    error EmptyField(string field);
    error FieldTooLong(string field, uint256 len);
    error UnknownReceipt(uint256 id);
    error AlreadySettled(uint256 id);
    error SignatureExpired(uint256 deadline);
    error InvalidSignature();
    error AlreadyInitialized();

    event ReceiptAnchored(
        uint256 indexed id,
        bytes32 indexed callerHash,
        uint64 indexed marketId,
        address attester,
        address submitter,
        string caller,
        string claim,
        uint16 probabilityBps,
        Verdict verdict,
        bytes32 evidenceHash,
        string evidenceJson
    );
    event ReceiptSettled(uint256 indexed id, bytes32 indexed callerHash, Outcome outcome, int64 alphaDelta, address settledBy);
    event AttesterSet(address indexed attester, bool allowed);
    event PausedSet(bool paused);

    // ───────────── storage ─────────────

    function layout() internal pure returns (Layout storage s) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            s.slot := position
        }
    }

    // ───────────── guards ─────────────

    function enforceAttester(address a) internal view {
        if (!layout().attesters[a]) revert NotAttester(a);
    }

    function enforceNotPaused() internal view {
        if (layout().paused) revert LedgerPaused();
    }

    // ───────────── rules ─────────────

    function verdictFor(uint16 bps) internal pure returns (Verdict) {
        if (bps >= 6500) return Verdict.LIKELY;
        if (bps >= 3500) return Verdict.COIN_FLIP;
        if (bps >= 1000) return Verdict.UNLIKELY;
        return Verdict.DELUSIONAL;
    }

    function _validate(AnchorInput memory a) private pure {
        if (a.probabilityBps > BPS) revert BadProbability(a.probabilityBps);
        uint256 cl = bytes(a.claim).length;
        if (cl == 0) revert EmptyField("claim");
        if (cl > MAX_CLAIM_BYTES) revert FieldTooLong("claim", cl);
        uint256 hl = bytes(a.caller).length;
        if (hl == 0) revert EmptyField("caller");
        if (hl > MAX_CALLER_BYTES) revert FieldTooLong("caller", hl);
        uint256 el = bytes(a.evidenceJson).length;
        if (el == 0) revert EmptyField("evidence");
        if (el > MAX_EVIDENCE_BYTES) revert FieldTooLong("evidence", el);
    }

    // ───────────── core writes ─────────────

    function anchor(AnchorInput memory a, address attester) internal returns (uint256 id) {
        _validate(a);
        Layout storage s = layout();

        bytes32 evHash = keccak256(bytes(a.evidenceJson));
        bytes32 cHash = keccak256(bytes(a.caller));
        Verdict v = verdictFor(a.probabilityBps);

        id = s.receipts.length;
        Receipt storage r = s.receipts.push();
        r.marketId = a.marketId;
        r.probabilityBps = a.probabilityBps;
        r.verdict = v;
        r.fearGreed = a.fearGreed;
        r.createdAt = uint64(block.timestamp);
        r.blockNumber = uint64(block.number);
        r.resolvesAt = a.resolvesAt;
        r.spotPriceE8 = a.spotPriceE8;
        r.attester = attester;
        r.callerHash = cHash;
        r.evidenceHash = evHash;
        r.caller = a.caller;
        r.asset = a.asset;
        r.claim = a.claim;

        CallerStats storage cs = s.callerStats[cHash];
        if (cs.calls == 0) s.callers.push(cHash);
        cs.calls += 1;
        cs.sumProbabilityBps += a.probabilityBps;
        s.byCaller[cHash].push(id);
        s.byMarket[a.marketId].push(id);

        emit ReceiptAnchored(id, cHash, a.marketId, attester, msg.sender, a.caller, a.claim, a.probabilityBps, v, evHash, a.evidenceJson);
    }

    /// @return delta alpha change applied to the caller
    function settle(uint256 id, bool hit) internal returns (int64 delta) {
        Layout storage s = layout();
        if (id >= s.receipts.length) revert UnknownReceipt(id);
        Receipt storage r = s.receipts[id];
        if (r.outcome != Outcome.PENDING) revert AlreadySettled(id);

        CallerStats storage cs = s.callerStats[r.callerHash];
        if (hit) {
            r.outcome = Outcome.HIT;
            cs.hits += 1;
            delta = int64(uint64(BPS - r.probabilityBps));
        } else {
            r.outcome = Outcome.MISS;
            cs.misses += 1;
            delta = -int64(uint64(r.probabilityBps));
        }
        cs.alphaBps += delta;
        emit ReceiptSettled(id, r.callerHash, r.outcome, delta, msg.sender);
    }

    // ───────────── EIP-712 ─────────────

    function domainSeparator() internal view returns (bytes32) {
        Layout storage s = layout();
        if (s.cachedChainId == block.chainid && s.cachedDomainSeparator != bytes32(0)) return s.cachedDomainSeparator;
        return _buildDomainSeparator();
    }

    function _buildDomainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    function cacheDomainSeparator() internal {
        Layout storage s = layout();
        s.cachedChainId = block.chainid;
        s.cachedDomainSeparator = _buildDomainSeparator();
    }

    function anchorStructHash(AnchorInput memory a, uint256 nonce, uint256 deadline) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ANCHOR_TYPEHASH,
                a.marketId,
                a.probabilityBps,
                a.fearGreed,
                a.resolvesAt,
                a.spotPriceE8,
                keccak256(bytes(a.caller)),
                keccak256(bytes(a.asset)),
                keccak256(bytes(a.claim)),
                keccak256(bytes(a.evidenceJson)),
                nonce,
                deadline
            )
        );
    }

    function digest(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    /// @dev Malleability-safe ecrecover (rejects high-s and bad v), no external deps.
    function recover(bytes32 hash, bytes memory sig) internal pure returns (address signer) {
        if (sig.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 sv;
        uint8 v;
        assembly {
            r := mload(add(sig, 0x20))
            sv := mload(add(sig, 0x40))
            v := byte(0, mload(add(sig, 0x60)))
        }
        if (uint256(sv) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) revert InvalidSignature();
        if (v != 27 && v != 28) revert InvalidSignature();
        signer = ecrecover(hash, v, r, sv);
        if (signer == address(0)) revert InvalidSignature();
    }
}
