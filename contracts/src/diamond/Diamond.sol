// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibDiamond} from "./libraries/LibDiamond.sol";
import {IDiamond} from "./interfaces/IDiamond.sol";

/// @title RECEIPTS Diamond (EIP-2535)
/// @notice Single, permanent address for the RECEIPTS ledger. All logic lives in facets
///         that can be upgraded independently without migrating a single receipt.
contract Diamond {
    error FunctionNotFound(bytes4 selector);

    struct DiamondArgs {
        address owner;
        address init;
        bytes initCalldata;
    }

    constructor(IDiamond.FacetCut[] memory _diamondCut, DiamondArgs memory _args) payable {
        LibDiamond.setContractOwner(_args.owner);
        LibDiamond.diamondCut(_diamondCut, _args.init, _args.initCalldata);
    }

    fallback() external payable {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        address facet = ds.facetAddressAndSelectorPosition[msg.sig].facetAddress;
        if (facet == address(0)) revert FunctionNotFound(msg.sig);
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
