// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {PropertyToken} from "../../contracts/PropertyToken.sol";
import {MockV3Aggregator} from "../../contracts/test/MockV3Aggregator.sol";

contract PropertyTokenGasTest is Test {
    string internal constant SNAPSHOT_GROUP = "PropertyTokenGas";
    uint256 internal constant ORACLE_MAX_AGE = 3 hours;
    int256 internal constant ETH_USD_PRICE = 3_000e8;

    function _deploy() internal returns (PropertyToken token) {
        MockV3Aggregator oracle = new MockV3Aggregator(8, ETH_USD_PRICE);
        token = new PropertyToken(address(this), address(this), address(oracle), ORACLE_MAX_AGE);
    }

    function _populate(PropertyToken token, uint256 holderCount, uint256 salt) internal {
        for (uint256 i = 1; i < holderCount; ++i) {
            // The deterministic test-only range is far below uint160.max.
            // forge-lint: disable-next-line(unsafe-typecast)
            address holder = address(uint160(10_000 + salt * 1_000 + i));
            token.setWhitelisted(holder, true);
            assertTrue(token.transfer(holder, 1 ether));
        }
    }

    function testGas_depositRemainsConstantAcrossHolderCounts() public {
        uint256[4] memory holderCounts = [uint256(1), 8, 32, 128];
        uint256 minimum = type(uint256).max;
        uint256 maximum;
        vm.deal(address(this), holderCounts.length * 1 ether);

        for (uint256 i = 0; i < holderCounts.length; ++i) {
            PropertyToken token = _deploy();
            _populate(token, holderCounts[i], i);

            token.depositYield{value: 1 ether}();
            uint256 gasUsed = vm.snapshotGasLastCall(
                SNAPSHOT_GROUP, string.concat("deposit.first.holders_", vm.toString(holderCounts[i]))
            );
            minimum = gasUsed < minimum ? gasUsed : minimum;
            maximum = gasUsed > maximum ? gasUsed : maximum;
        }

        assertLe(maximum - minimum, 500, "deposit gas scaled with holder count");
    }

    function testGas_coreOperationMatrix() public {
        PropertyToken token = _deploy();
        address alice = makeAddr("gas-alice");
        address bob = makeAddr("gas-bob");

        token.setWhitelisted(alice, true);
        vm.snapshotGasLastCall(SNAPSHOT_GROUP, "allowlist.add");
        token.setWhitelisted(bob, true);

        assertTrue(token.transfer(alice, 1_000 ether));
        vm.snapshotGasLastCall(SNAPSHOT_GROUP, "transfer.before_dividend");

        vm.deal(address(this), 2 ether);
        token.depositYield{value: 1 ether}();
        vm.snapshotGasLastCall(SNAPSHOT_GROUP, "deposit.first");

        vm.prank(alice);
        assertTrue(token.transfer(bob, 100 ether));
        vm.snapshotGasLastCall(SNAPSHOT_GROUP, "transfer.after_dividend");

        token.depositYield{value: 1 ether}();
        vm.snapshotGasLastCall(SNAPSHOT_GROUP, "deposit.subsequent");

        vm.prank(alice);
        token.claimYield();
        vm.snapshotGasLastCall(SNAPSHOT_GROUP, "claim.success");

        token.setWhitelisted(bob, false);
        vm.snapshotGasLastCall(SNAPSHOT_GROUP, "allowlist.revoke");

        token.updateRealWorldValuation(10_000_000 ether, uint64(block.timestamp), keccak256("gas-benchmark"));
        vm.snapshotGasLastCall(SNAPSHOT_GROUP, "valuation.update");

        MockV3Aggregator replacement = new MockV3Aggregator(8, 2_500e8);
        token.setEthUsdOracle(address(replacement), 1 hours);
        vm.snapshotGasLastCall(SNAPSHOT_GROUP, "oracle.update");
    }

    function testGas_deploymentAndRuntimeSize() public {
        MockV3Aggregator oracle = new MockV3Aggregator(8, ETH_USD_PRICE);
        vm.startSnapshotGas(SNAPSHOT_GROUP, "deployment");
        new PropertyToken(address(this), address(this), address(oracle), ORACLE_MAX_AGE);
        vm.stopSnapshotGas();

        uint256 runtimeSize = type(PropertyToken).runtimeCode.length;
        vm.snapshotValue(SNAPSHOT_GROUP, "runtime_bytecode_bytes", runtimeSize);
        assertLt(runtimeSize, 24_000, "runtime bytecode has insufficient EIP-170 headroom");
    }
}
