// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibDiamond} from "../diamond/libraries/LibDiamond.sol";
import {IDiamondCut, IDiamondLoupe, IERC165, IERC173} from "../diamond/interfaces/IDiamond.sol";
import {LibReceipts} from "./libraries/LibReceipts.sol";

/// @title ReceiptsInit — one-shot initializer delegatecalled during the first diamondCut.
contract ReceiptsInit {
    function init(address[] calldata attesters) external {
        LibReceipts.Layout storage s = LibReceipts.layout();
        if (s.initialized) revert LibReceipts.AlreadyInitialized();
        s.initialized = true;

        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;

        for (uint256 i; i < attesters.length; i++) {
            s.attesters[attesters[i]] = true;
            emit LibReceipts.AttesterSet(attesters[i], true);
        }
        LibReceipts.cacheDomainSeparator();
    }
}
