// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibReceipts} from "../libraries/LibReceipts.sol";

/// @title LedgerFacet — read path. Everything the app shows comes straight from these views.
contract LedgerFacet {
    struct CallerView {
        bytes32 hash;
        string handle;
        LibReceipts.CallerStats stats;
    }

    function totalReceipts() external view returns (uint256) {
        return LibReceipts.layout().receipts.length;
    }

    function totalCallers() external view returns (uint256) {
        return LibReceipts.layout().callers.length;
    }

    function getReceipt(uint256 id) external view returns (LibReceipts.Receipt memory) {
        LibReceipts.Layout storage s = LibReceipts.layout();
        if (id >= s.receipts.length) revert LibReceipts.UnknownReceipt(id);
        return s.receipts[id];
    }

    /// @notice Newest-first page of receipts.
    function latest(uint256 offset, uint256 limit)
        external
        view
        returns (LibReceipts.Receipt[] memory out, uint256[] memory ids)
    {
        LibReceipts.Layout storage s = LibReceipts.layout();
        uint256 n = s.receipts.length;
        if (offset >= n) return (new LibReceipts.Receipt[](0), new uint256[](0));
        uint256 end = n - offset;
        uint256 count = limit < end ? limit : end;
        out = new LibReceipts.Receipt[](count);
        ids = new uint256[](count);
        for (uint256 i; i < count; i++) {
            uint256 id = end - 1 - i;
            out[i] = s.receipts[id];
            ids[i] = id;
        }
    }

    function receiptsOf(bytes32 callerHash) external view returns (uint256[] memory) {
        return LibReceipts.layout().byCaller[callerHash];
    }

    function receiptsByMarket(uint64 marketId) external view returns (uint256[] memory) {
        return LibReceipts.layout().byMarket[marketId];
    }

    function callerStatsOf(bytes32 callerHash) external view returns (LibReceipts.CallerStats memory) {
        return LibReceipts.layout().callerStats[callerHash];
    }

    function callerAt(uint256 i) public view returns (bytes32 hash, string memory handle, LibReceipts.CallerStats memory stats) {
        LibReceipts.Layout storage s = LibReceipts.layout();
        hash = s.callers[i];
        handle = s.receipts[s.byCaller[hash][0]].caller;
        stats = s.callerStats[hash];
    }

    /// @notice Paged dump of all tracked callers (for leaderboards; sorting happens client-side).
    function callers(uint256 offset, uint256 limit) external view returns (CallerView[] memory out) {
        LibReceipts.Layout storage s = LibReceipts.layout();
        uint256 n = s.callers.length;
        if (offset >= n) return new CallerView[](0);
        uint256 count = limit < n - offset ? limit : n - offset;
        out = new CallerView[](count);
        for (uint256 i; i < count; i++) {
            (bytes32 h, string memory handle, LibReceipts.CallerStats memory st) = callerAt(offset + i);
            out[i] = CallerView(h, handle, st);
        }
    }

    function verdictFor(uint16 bps) external pure returns (LibReceipts.Verdict) {
        return LibReceipts.verdictFor(bps);
    }

    /// @notice Anyone can prove a piece of evidence JSON is byte-for-byte what was anchored.
    function verifyEvidence(uint256 id, string calldata evidenceJson) external view returns (bool) {
        LibReceipts.Layout storage s = LibReceipts.layout();
        if (id >= s.receipts.length) revert LibReceipts.UnknownReceipt(id);
        return s.receipts[id].evidenceHash == keccak256(bytes(evidenceJson));
    }
}
