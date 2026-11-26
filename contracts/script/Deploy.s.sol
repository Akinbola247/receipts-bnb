// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DiamondDeployer} from "./DiamondDeployer.sol";

/// forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC --broadcast --private-key $RELAYER_PRIVATE_KEY
contract Deploy is Script, DiamondDeployer {
    function run() external returns (Deployment memory d) {
        address deployer = msg.sender;
        address[] memory attesters = new address[](1);
        attesters[0] = deployer;

        vm.startBroadcast();
        d = _deployDiamond(deployer, attesters);
        vm.stopBroadcast();

        console2.log("DIAMOND", d.diamond);
        console2.log("DiamondCutFacet", d.cut);
        console2.log("DiamondLoupeFacet", d.loupe);
        console2.log("OwnershipFacet", d.ownership);
        console2.log("ReceiptFacet", d.receipt);
        console2.log("SettlementFacet", d.settlement);
        console2.log("LedgerFacet", d.ledger);
        console2.log("AdminFacet", d.admin);
        console2.log("ReceiptsInit", d.init);
    }
}
