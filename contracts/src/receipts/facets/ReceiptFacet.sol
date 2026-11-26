// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibReceipts} from "../libraries/LibReceipts.sol";

/// @title ReceiptFacet — write path of the ledger.
/// @notice Two ways in:
///         1. `anchor` / `anchorBatch` — an attester (our gas-sponsoring relayer) submits directly.
///         2. `anchorWithSig` — PERMISSIONLESS: anyone can submit a receipt an attester signed
///            off-chain (EIP-712). Users can self-anchor with their own wallet; the relayer
///            is a convenience, not a gatekeeper.
contract ReceiptFacet {
    function anchor(LibReceipts.AnchorInput calldata a) external returns (uint256 id) {
        LibReceipts.enforceNotPaused();
        LibReceipts.enforceAttester(msg.sender);
        id = LibReceipts.anchor(a, msg.sender);
    }

    function anchorBatch(LibReceipts.AnchorInput[] calldata items) external returns (uint256 firstId, uint256 count) {
        LibReceipts.enforceNotPaused();
        LibReceipts.enforceAttester(msg.sender);
        firstId = LibReceipts.layout().receipts.length;
        count = items.length;
        for (uint256 i; i < count; i++) {
            LibReceipts.anchor(items[i], msg.sender);
        }
    }

    function anchorWithSig(LibReceipts.AnchorInput calldata a, address attester, uint256 deadline, bytes calldata signature)
        external
        returns (uint256 id)
    {
        LibReceipts.enforceNotPaused();
        if (block.timestamp > deadline) revert LibReceipts.SignatureExpired(deadline);
        LibReceipts.enforceAttester(attester);

        LibReceipts.Layout storage s = LibReceipts.layout();
        uint256 nonce = s.nonces[attester];
        bytes32 d = LibReceipts.digest(LibReceipts.anchorStructHash(a, nonce, deadline));
        if (LibReceipts.recover(d, signature) != attester) revert LibReceipts.InvalidSignature();
        s.nonces[attester] = nonce + 1; // replay protection

        id = LibReceipts.anchor(a, attester);
    }

    /// @notice Helper for off-chain signers / UIs: the exact EIP-712 digest an attester must sign.
    function anchorDigest(LibReceipts.AnchorInput calldata a, uint256 nonce, uint256 deadline) external view returns (bytes32) {
        return LibReceipts.digest(LibReceipts.anchorStructHash(a, nonce, deadline));
    }
}
