// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibReceipts} from "../libraries/LibReceipts.sol";
import {LibSources} from "../libraries/LibSources.sol";

/// @title SourceFacet — ties every receipt to the original public post it is about.
/// @notice Added to the live diamond via diamondCut (no redeploy, no migration).
contract SourceFacet {
    /// @notice Anchor a receipt and its provenance atomically.
    function anchorWithSource(LibReceipts.AnchorInput calldata a, string calldata sourceUrl, uint64 postedAt)
        external
        returns (uint256 id)
    {
        LibReceipts.enforceNotPaused();
        LibReceipts.enforceAttester(msg.sender);
        id = LibReceipts.anchor(a, msg.sender);
        LibSources.link(id, sourceUrl, postedAt);
    }

    /// @notice Back-fill provenance for an existing receipt. Write-once.
    function linkSource(uint256 id, string calldata sourceUrl, uint64 postedAt) external {
        LibReceipts.enforceAttester(msg.sender);
        if (id >= LibReceipts.layout().receipts.length) revert LibReceipts.UnknownReceipt(id);
        LibSources.link(id, sourceUrl, postedAt);
    }

    function sourceOf(uint256 id) external view returns (LibSources.Source memory) {
        return LibSources.layout().sources[id];
    }

    function sourcesOf(uint256[] calldata ids) external view returns (LibSources.Source[] memory out) {
        LibSources.Layout storage s = LibSources.layout();
        out = new LibSources.Source[](ids.length);
        for (uint256 i; i < ids.length; i++) {
            out[i] = s.sources[ids[i]];
        }
    }

    function totalLinkedSources() external view returns (uint256) {
        return LibSources.layout().linked;
    }
}
