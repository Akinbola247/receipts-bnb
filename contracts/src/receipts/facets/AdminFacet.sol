// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibDiamond} from "../../diamond/libraries/LibDiamond.sol";
import {LibReceipts} from "../libraries/LibReceipts.sol";

/// @title AdminFacet — attester registry, circuit breaker, EIP-712 metadata.
contract AdminFacet {
    function setAttester(address attester, bool allowed) external {
        LibDiamond.enforceIsContractOwner();
        LibReceipts.layout().attesters[attester] = allowed;
        emit LibReceipts.AttesterSet(attester, allowed);
    }

    function setPaused(bool p) external {
        LibDiamond.enforceIsContractOwner();
        LibReceipts.layout().paused = p;
        emit LibReceipts.PausedSet(p);
    }

    function isAttester(address a) external view returns (bool) {
        return LibReceipts.layout().attesters[a];
    }

    function paused() external view returns (bool) {
        return LibReceipts.layout().paused;
    }

    function nonces(address attester) external view returns (uint256) {
        return LibReceipts.layout().nonces[attester];
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return LibReceipts.domainSeparator();
    }
}
