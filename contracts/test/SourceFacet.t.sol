// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DiamondDeployer} from "../script/DiamondDeployer.sol";
import {AddSourceFacet} from "../script/AddSourceFacet.s.sol";
import {IDiamond, IDiamondCut, IDiamondLoupe} from "../src/diamond/interfaces/IDiamond.sol";
import {LibReceipts} from "../src/receipts/libraries/LibReceipts.sol";
import {LibSources} from "../src/receipts/libraries/LibSources.sol";
import {ReceiptFacet} from "../src/receipts/facets/ReceiptFacet.sol";
import {LedgerFacet} from "../src/receipts/facets/LedgerFacet.sol";
import {SourceFacet} from "../src/receipts/facets/SourceFacet.sol";

contract SourceFacetTest is Test, DiamondDeployer {
    Deployment d;
    address attester = makeAddr("attester");
    address stranger = makeAddr("stranger");
    SourceFacet sources;
    string constant URL = "https://x.com/fundstrat/status/1234567890";

    function _input(string memory caller) internal view returns (LibReceipts.AnchorInput memory) {
        return LibReceipts.AnchorInput({
            marketId: 1210,
            probabilityBps: 1500,
            fearGreed: 10,
            resolvesAt: uint64(block.timestamp + 30 days),
            spotPriceE8: 60_000e8,
            caller: caller,
            asset: "BTC",
            claim: "Bitcoin will be above $100,000 by the end of 2026",
            evidenceJson: '{"code":0}'
        });
    }

    function setUp() public {
        vm.warp(1_795_700_000);
        address[] memory atts = new address[](1);
        atts[0] = attester;
        d = _deployDiamond(address(this), atts);

        // a receipt exists BEFORE the upgrade
        vm.prank(attester);
        ReceiptFacet(d.diamond).anchor(_input("@before"));

        // live upgrade: add SourceFacet
        SourceFacet facet = new SourceFacet();
        IDiamond.FacetCut[] memory cuts = new IDiamond.FacetCut[](1);
        cuts[0] = IDiamond.FacetCut(address(facet), IDiamond.FacetCutAction.Add, new AddSourceFacet().sourceSelectors());
        IDiamondCut(d.diamond).diamondCut(cuts, address(0), "");
        sources = SourceFacet(d.diamond);
    }

    function test_UpgradeAddsFacetAndKeepsReceipts() public view {
        assertEq(IDiamondLoupe(d.diamond).facetAddresses().length, 8);
        assertEq(LedgerFacet(d.diamond).totalReceipts(), 1);
        assertEq(LedgerFacet(d.diamond).getReceipt(0).caller, "@before");
    }

    function test_AnchorWithSourceIsAtomic() public {
        vm.prank(attester);
        uint256 id = sources.anchorWithSource(_input("@fundstrat"), URL, uint64(block.timestamp - 30 days));
        LibSources.Source memory s = sources.sourceOf(id);
        assertEq(s.url, URL);
        assertEq(s.postedAt, uint64(block.timestamp - 30 days));
        assertEq(s.linkedBy, attester);
        assertEq(sources.totalLinkedSources(), 1);
        assertEq(LedgerFacet(d.diamond).getReceipt(id).caller, "@fundstrat");
    }

    function test_BackfillExistingReceiptOnce() public {
        vm.startPrank(attester);
        sources.linkSource(0, URL, uint64(block.timestamp - 1 days));
        vm.expectRevert(abi.encodeWithSelector(LibSources.SourceAlreadySet.selector, 0));
        sources.linkSource(0, "https://example.com/other", uint64(block.timestamp));
        vm.stopPrank();
        uint256[] memory ids = new uint256[](1);
        assertEq(sources.sourcesOf(ids)[0].url, URL);
    }

    function test_RevertWhen_BadUrlOrFutureDateOrStranger() public {
        vm.startPrank(attester);
        vm.expectRevert(LibSources.BadSourceUrl.selector);
        sources.linkSource(0, "http://insecure.example.com/post", 1);
        vm.expectRevert(LibSources.BadSourceUrl.selector);
        sources.linkSource(0, "javascript:alert(1)//xx", 1);
        uint64 future = uint64(block.timestamp + 1 days);
        vm.expectRevert(abi.encodeWithSelector(LibSources.PostedInFuture.selector, future));
        sources.linkSource(0, URL, future);
        vm.expectRevert(abi.encodeWithSelector(LibReceipts.UnknownReceipt.selector, 99));
        sources.linkSource(99, URL, 1);
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(LibReceipts.NotAttester.selector, stranger));
        sources.linkSource(0, URL, 1);
    }
}
