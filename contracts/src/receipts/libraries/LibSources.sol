// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LibSources — provenance for receipts: where the call was originally made.
/// @dev   Lives in its OWN diamond-storage namespace, added by a later diamondCut. It never touches
///        LibReceipts' layout, which is exactly how the diamond grows without migrations.
library LibSources {
    bytes32 internal constant STORAGE_POSITION = keccak256("receipts.sources.storage.v1");

    uint256 internal constant MIN_URL = 12;
    uint256 internal constant MAX_URL = 300;

    struct Source {
        string url; // original post (x.com status, YouTube, report, article)
        uint64 postedAt; // when the caller made the call (unix seconds)
        address linkedBy;
    }

    struct Layout {
        mapping(uint256 => Source) sources;
        uint256 linked;
    }

    error SourceAlreadySet(uint256 id);
    error BadSourceUrl();
    error PostedInFuture(uint64 postedAt);

    event SourceLinked(uint256 indexed id, string url, uint64 postedAt, address indexed linkedBy);

    function layout() internal pure returns (Layout storage s) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            s.slot := position
        }
    }

    /// @dev Requires an https:// URL of sane length. Write-once: provenance can't be swapped later.
    function link(uint256 id, string memory url, uint64 postedAt) internal {
        bytes memory u = bytes(url);
        if (u.length < MIN_URL || u.length > MAX_URL) revert BadSourceUrl();
        if (
            u[0] != "h" || u[1] != "t" || u[2] != "t" || u[3] != "p" || u[4] != "s" || u[5] != ":" || u[6] != "/"
                || u[7] != "/"
        ) revert BadSourceUrl();
        if (postedAt > block.timestamp) revert PostedInFuture(postedAt);

        Layout storage s = layout();
        if (bytes(s.sources[id].url).length != 0) revert SourceAlreadySet(id);
        s.sources[id] = Source({url: url, postedAt: postedAt, linkedBy: msg.sender});
        s.linked += 1;
        emit SourceLinked(id, url, postedAt, msg.sender);
    }
}
