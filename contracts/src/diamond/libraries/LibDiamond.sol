// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDiamond, IDiamondCut} from "../interfaces/IDiamond.sol";

/// @title LibDiamond — EIP-2535 selector routing + ownership, in namespaced storage.
library LibDiamond {
    bytes32 internal constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.diamond.storage");

    error NotContractOwner(address sender, address owner);
    error NoSelectorsInFacet();
    error FacetHasNoCode(address facet);
    error SelectorAlreadyExists(bytes4 selector);
    error SelectorNotFound(bytes4 selector);
    error SameFacetReplace(bytes4 selector);
    error ImmutableFunction(bytes4 selector);
    error RemoveFacetMustBeZero(address facet);
    error InitReverted(address init, bytes data);
    error IncorrectFacetCutAction(uint8 action);

    struct FacetAddressAndSelectorPosition {
        address facetAddress;
        uint16 selectorPosition;
    }

    struct DiamondStorage {
        mapping(bytes4 => FacetAddressAndSelectorPosition) facetAddressAndSelectorPosition;
        bytes4[] selectors;
        mapping(bytes4 => bool) supportedInterfaces;
        address contractOwner;
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    // ───────────── ownership ─────────────

    function setContractOwner(address _newOwner) internal {
        DiamondStorage storage ds = diamondStorage();
        address previousOwner = ds.contractOwner;
        ds.contractOwner = _newOwner;
        emit OwnershipTransferred(previousOwner, _newOwner);
    }

    function contractOwner() internal view returns (address) {
        return diamondStorage().contractOwner;
    }

    function enforceIsContractOwner() internal view {
        address o = diamondStorage().contractOwner;
        if (msg.sender != o) revert NotContractOwner(msg.sender, o);
    }

    // ───────────── cutting ─────────────

    function diamondCut(IDiamond.FacetCut[] memory _diamondCut, address _init, bytes memory _calldata) internal {
        for (uint256 i; i < _diamondCut.length; i++) {
            IDiamond.FacetCut memory cut = _diamondCut[i];
            if (cut.functionSelectors.length == 0) revert NoSelectorsInFacet();
            if (cut.action == IDiamond.FacetCutAction.Add) {
                addFunctions(cut.facetAddress, cut.functionSelectors);
            } else if (cut.action == IDiamond.FacetCutAction.Replace) {
                replaceFunctions(cut.facetAddress, cut.functionSelectors);
            } else if (cut.action == IDiamond.FacetCutAction.Remove) {
                removeFunctions(cut.facetAddress, cut.functionSelectors);
            } else {
                revert IncorrectFacetCutAction(uint8(cut.action));
            }
        }
        emit IDiamond.DiamondCut(_diamondCut, _init, _calldata);
        initializeDiamondCut(_init, _calldata);
    }

    function addFunctions(address _facet, bytes4[] memory _selectors) internal {
        DiamondStorage storage ds = diamondStorage();
        enforceHasContractCode(_facet);
        uint16 position = uint16(ds.selectors.length);
        for (uint256 i; i < _selectors.length; i++) {
            bytes4 sel = _selectors[i];
            if (ds.facetAddressAndSelectorPosition[sel].facetAddress != address(0)) revert SelectorAlreadyExists(sel);
            ds.facetAddressAndSelectorPosition[sel] = FacetAddressAndSelectorPosition(_facet, position);
            ds.selectors.push(sel);
            position++;
        }
    }

    function replaceFunctions(address _facet, bytes4[] memory _selectors) internal {
        DiamondStorage storage ds = diamondStorage();
        enforceHasContractCode(_facet);
        for (uint256 i; i < _selectors.length; i++) {
            bytes4 sel = _selectors[i];
            address old = ds.facetAddressAndSelectorPosition[sel].facetAddress;
            if (old == address(0)) revert SelectorNotFound(sel);
            if (old == address(this)) revert ImmutableFunction(sel);
            if (old == _facet) revert SameFacetReplace(sel);
            ds.facetAddressAndSelectorPosition[sel].facetAddress = _facet;
        }
    }

    function removeFunctions(address _facet, bytes4[] memory _selectors) internal {
        if (_facet != address(0)) revert RemoveFacetMustBeZero(_facet);
        DiamondStorage storage ds = diamondStorage();
        uint256 selectorCount = ds.selectors.length;
        for (uint256 i; i < _selectors.length; i++) {
            bytes4 sel = _selectors[i];
            FacetAddressAndSelectorPosition memory old = ds.facetAddressAndSelectorPosition[sel];
            if (old.facetAddress == address(0)) revert SelectorNotFound(sel);
            if (old.facetAddress == address(this)) revert ImmutableFunction(sel);
            // swap-and-pop
            selectorCount--;
            if (old.selectorPosition != selectorCount) {
                bytes4 last = ds.selectors[selectorCount];
                ds.selectors[old.selectorPosition] = last;
                ds.facetAddressAndSelectorPosition[last].selectorPosition = old.selectorPosition;
            }
            ds.selectors.pop();
            delete ds.facetAddressAndSelectorPosition[sel];
        }
    }

    function initializeDiamondCut(address _init, bytes memory _calldata) internal {
        if (_init == address(0)) return;
        enforceHasContractCode(_init);
        (bool success, bytes memory error) = _init.delegatecall(_calldata);
        if (!success) {
            if (error.length > 0) {
                assembly {
                    revert(add(32, error), mload(error))
                }
            }
            revert InitReverted(_init, _calldata);
        }
    }

    function enforceHasContractCode(address _contract) internal view {
        uint256 size;
        assembly {
            size := extcodesize(_contract)
        }
        if (size == 0) revert FacetHasNoCode(_contract);
    }
}
