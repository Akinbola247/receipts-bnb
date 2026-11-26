// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Diamond} from "../src/diamond/Diamond.sol";
import {IDiamond} from "../src/diamond/interfaces/IDiamond.sol";
import {DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet} from "../src/diamond/facets/DiamondCoreFacets.sol";
import {ReceiptFacet} from "../src/receipts/facets/ReceiptFacet.sol";
import {SettlementFacet} from "../src/receipts/facets/SettlementFacet.sol";
import {LedgerFacet} from "../src/receipts/facets/LedgerFacet.sol";
import {AdminFacet} from "../src/receipts/facets/AdminFacet.sol";
import {ReceiptsInit} from "../src/receipts/ReceiptsInit.sol";

/// @notice Shared by the deploy script and the test-suite so both build the exact same diamond.
abstract contract DiamondDeployer {
    struct Deployment {
        address diamond;
        address cut;
        address loupe;
        address ownership;
        address receipt;
        address settlement;
        address ledger;
        address admin;
        address init;
    }

    function _deployDiamond(address owner, address[] memory attesters) internal returns (Deployment memory d) {
        d.cut = address(new DiamondCutFacet());
        d.loupe = address(new DiamondLoupeFacet());
        d.ownership = address(new OwnershipFacet());
        d.receipt = address(new ReceiptFacet());
        d.settlement = address(new SettlementFacet());
        d.ledger = address(new LedgerFacet());
        d.admin = address(new AdminFacet());
        d.init = address(new ReceiptsInit());

        IDiamond.FacetCut[] memory cuts = new IDiamond.FacetCut[](7);
        cuts[0] = _cut(d.cut, cutSelectors());
        cuts[1] = _cut(d.loupe, loupeSelectors());
        cuts[2] = _cut(d.ownership, ownershipSelectors());
        cuts[3] = _cut(d.receipt, receiptSelectors());
        cuts[4] = _cut(d.settlement, settlementSelectors());
        cuts[5] = _cut(d.ledger, ledgerSelectors());
        cuts[6] = _cut(d.admin, adminSelectors());

        d.diamond = address(
            new Diamond(
                cuts,
                Diamond.DiamondArgs({
                    owner: owner,
                    init: d.init,
                    initCalldata: abi.encodeCall(ReceiptsInit.init, (attesters))
                })
            )
        );
    }

    function _cut(address facet, bytes4[] memory sels) internal pure returns (IDiamond.FacetCut memory) {
        return IDiamond.FacetCut({facetAddress: facet, action: IDiamond.FacetCutAction.Add, functionSelectors: sels});
    }

    function cutSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](1);
        s[0] = DiamondCutFacet.diamondCut.selector;
    }

    function loupeSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](5);
        s[0] = DiamondLoupeFacet.facets.selector;
        s[1] = DiamondLoupeFacet.facetFunctionSelectors.selector;
        s[2] = DiamondLoupeFacet.facetAddresses.selector;
        s[3] = DiamondLoupeFacet.facetAddress.selector;
        s[4] = DiamondLoupeFacet.supportsInterface.selector;
    }

    function ownershipSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](2);
        s[0] = OwnershipFacet.transferOwnership.selector;
        s[1] = OwnershipFacet.owner.selector;
    }

    function receiptSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](4);
        s[0] = ReceiptFacet.anchor.selector;
        s[1] = ReceiptFacet.anchorBatch.selector;
        s[2] = ReceiptFacet.anchorWithSig.selector;
        s[3] = ReceiptFacet.anchorDigest.selector;
    }

    function settlementSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](2);
        s[0] = SettlementFacet.settle.selector;
        s[1] = SettlementFacet.settleMarket.selector;
    }

    function ledgerSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](11);
        s[0] = LedgerFacet.totalReceipts.selector;
        s[1] = LedgerFacet.totalCallers.selector;
        s[2] = LedgerFacet.getReceipt.selector;
        s[3] = LedgerFacet.latest.selector;
        s[4] = LedgerFacet.receiptsOf.selector;
        s[5] = LedgerFacet.receiptsByMarket.selector;
        s[6] = LedgerFacet.callerStatsOf.selector;
        s[7] = LedgerFacet.callerAt.selector;
        s[8] = LedgerFacet.callers.selector;
        s[9] = LedgerFacet.verdictFor.selector;
        s[10] = LedgerFacet.verifyEvidence.selector;
    }

    function adminSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](6);
        s[0] = AdminFacet.setAttester.selector;
        s[1] = AdminFacet.setPaused.selector;
        s[2] = AdminFacet.isAttester.selector;
        s[3] = AdminFacet.paused.selector;
        s[4] = AdminFacet.nonces.selector;
        s[5] = AdminFacet.DOMAIN_SEPARATOR.selector;
    }
}
