// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DiamondDeployer} from "../script/DiamondDeployer.sol";
import {IDiamond, IDiamondCut, IDiamondLoupe, IERC165, IERC173} from "../src/diamond/interfaces/IDiamond.sol";
import {LibDiamond} from "../src/diamond/libraries/LibDiamond.sol";
import {Diamond} from "../src/diamond/Diamond.sol";
import {LibReceipts} from "../src/receipts/libraries/LibReceipts.sol";
import {ReceiptFacet} from "../src/receipts/facets/ReceiptFacet.sol";
import {SettlementFacet} from "../src/receipts/facets/SettlementFacet.sol";
import {LedgerFacet} from "../src/receipts/facets/LedgerFacet.sol";
import {AdminFacet} from "../src/receipts/facets/AdminFacet.sol";

/// @dev A v2 facet used to prove upgrades keep all stored receipts.
contract LedgerFacetV2 is LedgerFacet {
    function ledgerVersion() external pure returns (uint256) {
        return 2;
    }
}

contract ReceiptsTest is Test, DiamondDeployer {
    Deployment d;
    address owner = address(this);
    uint256 attesterPk = 0xA11CE;
    address attester;
    address stranger = makeAddr("stranger");

    ReceiptFacet receipts;
    SettlementFacet settlement;
    LedgerFacet ledger;
    AdminFacet admin;

    string constant EVIDENCE = '{"code":0,"msg":"Success","data":{"probability":0.04}}';

    function setUp() public {
        attester = vm.addr(attesterPk);
        address[] memory atts = new address[](1);
        atts[0] = attester;
        d = _deployDiamond(owner, atts);
        receipts = ReceiptFacet(d.diamond);
        settlement = SettlementFacet(d.diamond);
        ledger = LedgerFacet(d.diamond);
        admin = AdminFacet(d.diamond);
    }

    function _input(string memory caller, uint16 bps, uint64 marketId) internal view returns (LibReceipts.AnchorInput memory) {
        return LibReceipts.AnchorInput({
            marketId: marketId,
            probabilityBps: bps,
            fearGreed: 10,
            resolvesAt: uint64(block.timestamp + 1 days),
            spotPriceE8: 556_46000000,
            caller: caller,
            asset: "BNB",
            claim: "BNB above $685 by tomorrow",
            evidenceJson: EVIDENCE
        });
    }

    // ───────────── diamond plumbing ─────────────

    function test_LoupeReportsAllFacets() public view {
        IDiamondLoupe loupe = IDiamondLoupe(d.diamond);
        assertEq(loupe.facetAddresses().length, 7);
        assertEq(loupe.facetAddress(ReceiptFacet.anchor.selector), d.receipt);
        assertEq(loupe.facetAddress(LedgerFacet.latest.selector), d.ledger);
        assertEq(loupe.facetFunctionSelectors(d.ledger).length, 11);
        IDiamondLoupe.Facet[] memory fs = loupe.facets();
        uint256 total;
        for (uint256 i; i < fs.length; i++) total += fs[i].functionSelectors.length;
        assertEq(total, 31);
    }

    function test_SupportsInterfaces() public view {
        IERC165 e = IERC165(d.diamond);
        assertTrue(e.supportsInterface(type(IERC165).interfaceId));
        assertTrue(e.supportsInterface(type(IDiamondCut).interfaceId));
        assertTrue(e.supportsInterface(type(IDiamondLoupe).interfaceId));
        assertTrue(e.supportsInterface(type(IERC173).interfaceId));
        assertEq(IERC173(d.diamond).owner(), owner);
    }

    function test_UnknownSelectorReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Diamond.FunctionNotFound.selector, bytes4(0xdeadbeef)));
        (bool ok,) = d.diamond.call(abi.encodeWithSelector(bytes4(0xdeadbeef)));
        ok;
    }

    function test_InitCannotRunTwice() public {
        address[] memory atts = new address[](0);
        IDiamond.FacetCut[] memory none = new IDiamond.FacetCut[](0);
        vm.expectRevert(LibReceipts.AlreadyInitialized.selector);
        IDiamondCut(d.diamond).diamondCut(none, d.init, abi.encodeWithSignature("init(address[])", atts));
    }

    function test_UpgradeKeepsReceipts() public {
        vm.prank(attester);
        receipts.anchor(_input("@alice", 400, 1));

        LedgerFacetV2 v2 = new LedgerFacetV2();
        IDiamond.FacetCut[] memory cuts = new IDiamond.FacetCut[](2);
        cuts[0] = _cut(address(v2), ledgerSelectors());
        cuts[0].action = IDiamond.FacetCutAction.Replace;
        bytes4[] memory added = new bytes4[](1);
        added[0] = LedgerFacetV2.ledgerVersion.selector;
        cuts[1] = _cut(address(v2), added);
        IDiamondCut(d.diamond).diamondCut(cuts, address(0), "");

        assertEq(LedgerFacetV2(d.diamond).ledgerVersion(), 2);
        assertEq(ledger.totalReceipts(), 1);
        assertEq(ledger.getReceipt(0).caller, "@alice");
        assertEq(IDiamondLoupe(d.diamond).facetAddress(LedgerFacet.latest.selector), address(v2));
    }

    function test_RemoveFunction() public {
        IDiamond.FacetCut[] memory cuts = new IDiamond.FacetCut[](1);
        bytes4[] memory sel = new bytes4[](1);
        sel[0] = LedgerFacet.verdictFor.selector;
        cuts[0] = IDiamond.FacetCut(address(0), IDiamond.FacetCutAction.Remove, sel);
        IDiamondCut(d.diamond).diamondCut(cuts, address(0), "");
        assertEq(IDiamondLoupe(d.diamond).facetAddress(sel[0]), address(0));
        vm.expectRevert();
        ledger.verdictFor(100);
    }

    function test_OnlyOwnerCanCut() public {
        IDiamond.FacetCut[] memory none = new IDiamond.FacetCut[](0);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(LibDiamond.NotContractOwner.selector, stranger, owner));
        IDiamondCut(d.diamond).diamondCut(none, address(0), "");
    }

    // ───────────── anchoring ─────────────

    function test_AnchorStoresEverything() public {
        vm.prank(attester);
        uint256 id = receipts.anchor(_input("@alice", 400, 112834));
        assertEq(id, 0);
        LibReceipts.Receipt memory r = ledger.getReceipt(0);
        assertEq(r.marketId, 112834);
        assertEq(r.probabilityBps, 400);
        assertEq(uint8(r.verdict), uint8(LibReceipts.Verdict.DELUSIONAL));
        assertEq(r.attester, attester);
        assertEq(r.evidenceHash, keccak256(bytes(EVIDENCE)));
        assertEq(r.blockNumber, block.number);
        assertTrue(ledger.verifyEvidence(0, EVIDENCE));
        assertFalse(ledger.verifyEvidence(0, '{"tampered":true}'));
        assertEq(ledger.totalCallers(), 1);
        assertEq(ledger.receiptsByMarket(112834).length, 1);
        (, string memory handle, LibReceipts.CallerStats memory st) = ledger.callerAt(0);
        assertEq(handle, "@alice");
        assertEq(st.calls, 1);
        assertEq(st.sumProbabilityBps, 400);
    }

    function test_LatestIsNewestFirst() public {
        vm.startPrank(attester);
        receipts.anchor(_input("@a", 100, 1));
        receipts.anchor(_input("@b", 5000, 2));
        receipts.anchor(_input("@a", 9000, 3));
        vm.stopPrank();
        (LibReceipts.Receipt[] memory rows, uint256[] memory ids) = ledger.latest(0, 2);
        assertEq(rows.length, 2);
        assertEq(ids[0], 2);
        assertEq(ids[1], 1);
        assertEq(ledger.totalCallers(), 2);
        assertEq(ledger.receiptsOf(keccak256("@a")).length, 2);
        LedgerFacet.CallerView[] memory cv = ledger.callers(0, 10);
        assertEq(cv.length, 2);
        assertEq(cv[0].stats.calls, 2);
    }

    function test_AnchorBatch() public {
        LibReceipts.AnchorInput[] memory items = new LibReceipts.AnchorInput[](3);
        items[0] = _input("@a", 100, 1);
        items[1] = _input("@b", 4000, 1);
        items[2] = _input("@c", 7000, 2);
        vm.prank(attester);
        (uint256 first, uint256 count) = receipts.anchorBatch(items);
        assertEq(first, 0);
        assertEq(count, 3);
        assertEq(ledger.totalReceipts(), 3);
    }

    function test_RevertWhen_NotAttester() public {
        LibReceipts.AnchorInput memory a = _input("@a", 100, 1);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(LibReceipts.NotAttester.selector, stranger));
        receipts.anchor(a);
    }

    function test_RevertWhen_Paused() public {
        admin.setPaused(true);
        LibReceipts.AnchorInput memory a = _input("@a", 100, 1);
        vm.prank(attester);
        vm.expectRevert(LibReceipts.LedgerPaused.selector);
        receipts.anchor(a);
    }

    function test_RevertWhen_BadInputs() public {
        LibReceipts.AnchorInput memory a = _input("@a", 10_001, 1);
        vm.startPrank(attester);
        vm.expectRevert(abi.encodeWithSelector(LibReceipts.BadProbability.selector, uint16(10_001)));
        receipts.anchor(a);

        a = _input("@a", 100, 1);
        a.claim = "";
        vm.expectRevert(abi.encodeWithSelector(LibReceipts.EmptyField.selector, "claim"));
        receipts.anchor(a);

        a = _input("@this_handle_is_way_too_long_to_be_real", 100, 1);
        vm.expectRevert();
        receipts.anchor(a);
        vm.stopPrank();
    }

    // ───────────── EIP-712 permissionless path ─────────────

    function _sign(LibReceipts.AnchorInput memory a, uint256 nonce, uint256 deadline, uint256 pk) internal view returns (bytes memory) {
        bytes32 digest = receipts.anchorDigest(a, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_AnyoneCanSubmitSignedReceipt() public {
        LibReceipts.AnchorInput memory a = _input("@alice", 2500, 7);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(a, 0, deadline, attesterPk);

        vm.prank(stranger);
        uint256 id = receipts.anchorWithSig(a, attester, deadline, sig);
        assertEq(ledger.getReceipt(id).attester, attester);
        assertEq(admin.nonces(attester), 1);

        // replay fails: nonce moved on
        vm.prank(stranger);
        vm.expectRevert(LibReceipts.InvalidSignature.selector);
        receipts.anchorWithSig(a, attester, deadline, sig);
    }

    function test_RevertWhen_SignatureExpired() public {
        LibReceipts.AnchorInput memory a = _input("@alice", 2500, 7);
        uint256 deadline = block.timestamp + 10;
        bytes memory sig = _sign(a, 0, deadline, attesterPk);
        vm.warp(deadline + 1);
        vm.expectRevert(abi.encodeWithSelector(LibReceipts.SignatureExpired.selector, deadline));
        receipts.anchorWithSig(a, attester, deadline, sig);
    }

    function test_RevertWhen_SignerIsNotAttester() public {
        LibReceipts.AnchorInput memory a = _input("@alice", 2500, 7);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(a, 0, deadline, 0xB0B);
        vm.expectRevert(LibReceipts.InvalidSignature.selector);
        receipts.anchorWithSig(a, attester, deadline, sig);
    }

    function test_RevertWhen_TamperedPayload() public {
        LibReceipts.AnchorInput memory a = _input("@alice", 2500, 7);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(a, 0, deadline, attesterPk);
        a.probabilityBps = 9900; // try to inflate the odds
        vm.expectRevert(LibReceipts.InvalidSignature.selector);
        receipts.anchorWithSig(a, attester, deadline, sig);
    }

    // ───────────── settlement & alpha ─────────────

    function test_AlphaRewardsBeatingTheMarket() public {
        vm.startPrank(attester);
        receipts.anchor(_input("@contrarian", 400, 1)); // market said 4%
        receipts.anchor(_input("@contrarian", 8000, 2)); // market said 80%
        vm.warp(block.timestamp + 2 days);
        assertEq(settlement.settle(0, true), int64(9600)); // hit a 4% call → +9600
        assertEq(settlement.settle(1, false), -int64(8000)); // missed an 80% call → -8000
        vm.stopPrank();

        LibReceipts.CallerStats memory st = ledger.callerStatsOf(keccak256("@contrarian"));
        assertEq(st.hits, 1);
        assertEq(st.misses, 1);
        assertEq(st.alphaBps, 1600);
        assertEq(uint8(ledger.getReceipt(0).outcome), uint8(LibReceipts.Outcome.HIT));
    }

    function test_RevertWhen_SettlingTooEarlyOrTwice() public {
        vm.startPrank(attester);
        receipts.anchor(_input("@a", 400, 1));
        vm.expectRevert();
        settlement.settle(0, true);
        vm.warp(block.timestamp + 2 days);
        settlement.settle(0, true);
        vm.expectRevert(abi.encodeWithSelector(LibReceipts.AlreadySettled.selector, 0));
        settlement.settle(0, false);
        vm.stopPrank();
    }

    function test_SettleMarketInOneTx() public {
        vm.startPrank(attester);
        receipts.anchor(_input("@a", 1000, 42));
        receipts.anchor(_input("@b", 3000, 42));
        receipts.anchor(_input("@c", 5000, 43));
        vm.warp(block.timestamp + 2 days);
        assertEq(settlement.settleMarket(42, false, 10), 2);
        vm.stopPrank();
        assertEq(ledger.callerStatsOf(keccak256("@a")).alphaBps, -1000);
        assertEq(ledger.callerStatsOf(keccak256("@b")).alphaBps, -3000);
        assertEq(uint8(ledger.getReceipt(2).outcome), uint8(LibReceipts.Outcome.PENDING));
    }

    // ───────────── rule invariants ─────────────

    function testFuzz_VerdictMatchesThresholds(uint16 bps) public view {
        bps = uint16(bound(bps, 0, 10_000));
        LibReceipts.Verdict v = ledger.verdictFor(bps);
        if (bps >= 6500) assertEq(uint8(v), 0);
        else if (bps >= 3500) assertEq(uint8(v), 1);
        else if (bps >= 1000) assertEq(uint8(v), 2);
        else assertEq(uint8(v), 3);
    }
}
