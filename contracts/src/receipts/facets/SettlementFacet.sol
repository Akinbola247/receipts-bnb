// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibReceipts} from "../libraries/LibReceipts.sol";

/// @title SettlementFacet — closes the loop once a Cournot market resolves and updates
///        each caller's market-relative alpha score.
contract SettlementFacet {
    error TooEarly(uint256 id, uint64 resolvesAt);

    function settle(uint256 id, bool hit) external returns (int64 alphaDelta) {
        LibReceipts.enforceAttester(msg.sender);
        LibReceipts.Receipt storage r = LibReceipts.layout().receipts[_checked(id)];
        if (r.resolvesAt != 0 && block.timestamp < r.resolvesAt) revert TooEarly(id, r.resolvesAt);
        alphaDelta = LibReceipts.settle(id, hit);
    }

    /// @notice Settle every still-pending receipt for a market in one transaction.
    /// @param maxCount bound on work per call (gas safety); call again to continue.
    function settleMarket(uint64 marketId, bool yes, uint256 maxCount) external returns (uint256 settled) {
        LibReceipts.enforceAttester(msg.sender);
        LibReceipts.Layout storage s = LibReceipts.layout();
        uint256[] storage ids = s.byMarket[marketId];
        uint256 n = ids.length;
        for (uint256 i; i < n && settled < maxCount; i++) {
            LibReceipts.Receipt storage r = s.receipts[ids[i]];
            if (r.outcome != LibReceipts.Outcome.PENDING) continue;
            if (r.resolvesAt != 0 && block.timestamp < r.resolvesAt) revert TooEarly(ids[i], r.resolvesAt);
            LibReceipts.settle(ids[i], yes);
            settled++;
        }
    }

    function _checked(uint256 id) private view returns (uint256) {
        if (id >= LibReceipts.layout().receipts.length) revert LibReceipts.UnknownReceipt(id);
        return id;
    }
}
