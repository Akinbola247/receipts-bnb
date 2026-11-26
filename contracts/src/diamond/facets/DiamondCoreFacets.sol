// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {IDiamondCut, IDiamondLoupe, IERC165, IERC173} from "../interfaces/IDiamond.sol";

contract DiamondCutFacet is IDiamondCut {
    function diamondCut(FacetCut[] calldata _diamondCut, address _init, bytes calldata _calldata) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.diamondCut(_diamondCut, _init, _calldata);
    }
}

contract DiamondLoupeFacet is IDiamondLoupe, IERC165 {
    function facets() external view override returns (Facet[] memory facets_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 selectorCount = ds.selectors.length;
        facets_ = new Facet[](selectorCount);
        uint16[] memory numSelectors = new uint16[](selectorCount);
        uint256 numFacets;
        for (uint256 i; i < selectorCount; i++) {
            bytes4 sel = ds.selectors[i];
            address facet = ds.facetAddressAndSelectorPosition[sel].facetAddress;
            bool found;
            for (uint256 f; f < numFacets; f++) {
                if (facets_[f].facetAddress == facet) {
                    facets_[f].functionSelectors[numSelectors[f]] = sel;
                    numSelectors[f]++;
                    found = true;
                    break;
                }
            }
            if (found) continue;
            facets_[numFacets].facetAddress = facet;
            facets_[numFacets].functionSelectors = new bytes4[](selectorCount);
            facets_[numFacets].functionSelectors[0] = sel;
            numSelectors[numFacets] = 1;
            numFacets++;
        }
        for (uint256 f; f < numFacets; f++) {
            bytes4[] memory s = facets_[f].functionSelectors;
            uint256 n = numSelectors[f];
            assembly {
                mstore(s, n)
            }
        }
        assembly {
            mstore(facets_, numFacets)
        }
    }

    function facetFunctionSelectors(address _facet) external view override returns (bytes4[] memory selectors_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 selectorCount = ds.selectors.length;
        uint256 n;
        selectors_ = new bytes4[](selectorCount);
        for (uint256 i; i < selectorCount; i++) {
            bytes4 sel = ds.selectors[i];
            if (ds.facetAddressAndSelectorPosition[sel].facetAddress == _facet) {
                selectors_[n++] = sel;
            }
        }
        assembly {
            mstore(selectors_, n)
        }
    }

    function facetAddresses() external view override returns (address[] memory addrs_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 selectorCount = ds.selectors.length;
        addrs_ = new address[](selectorCount);
        uint256 n;
        for (uint256 i; i < selectorCount; i++) {
            address facet = ds.facetAddressAndSelectorPosition[ds.selectors[i]].facetAddress;
            bool seen;
            for (uint256 j; j < n; j++) {
                if (addrs_[j] == facet) {
                    seen = true;
                    break;
                }
            }
            if (!seen) addrs_[n++] = facet;
        }
        assembly {
            mstore(addrs_, n)
        }
    }

    function facetAddress(bytes4 _functionSelector) external view override returns (address) {
        return LibDiamond.diamondStorage().facetAddressAndSelectorPosition[_functionSelector].facetAddress;
    }

    function supportsInterface(bytes4 _interfaceId) external view override returns (bool) {
        return LibDiamond.diamondStorage().supportedInterfaces[_interfaceId];
    }
}

contract OwnershipFacet is IERC173 {
    function transferOwnership(address _newOwner) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setContractOwner(_newOwner);
    }

    function owner() external view override returns (address) {
        return LibDiamond.contractOwner();
    }
}
