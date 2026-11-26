// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IDiamond, IDiamondCut} from "../src/diamond/interfaces/IDiamond.sol";
import {SourceFacet} from "../src/receipts/facets/SourceFacet.sol";

/// Live upgrade: adds SourceFacet to the deployed diamond. Existing receipts are untouched.
/// DIAMOND=0x... forge script script/AddSourceFacet.s.sol --rpc-url $RPC --private-key $PK --broadcast
contract AddSourceFacet is Script {
    function sourceSelectors() public pure returns (bytes4[] memory s) {
        s = new bytes4[](5);
        s[0] = SourceFacet.anchorWithSource.selector;
        s[1] = SourceFacet.linkSource.selector;
        s[2] = SourceFacet.sourceOf.selector;
        s[3] = SourceFacet.sourcesOf.selector;
        s[4] = SourceFacet.totalLinkedSources.selector;
    }

    function run() external {
        address diamond = vm.envAddress("DIAMOND");
        vm.startBroadcast();
        SourceFacet facet = new SourceFacet();
        IDiamond.FacetCut[] memory cuts = new IDiamond.FacetCut[](1);
        cuts[0] = IDiamond.FacetCut({facetAddress: address(facet), action: IDiamond.FacetCutAction.Add, functionSelectors: sourceSelectors()});
        IDiamondCut(diamond).diamondCut(cuts, address(0), "");
        vm.stopBroadcast();
        console2.log("SourceFacet", address(facet));
    }
}
