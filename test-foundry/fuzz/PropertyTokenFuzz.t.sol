// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Test} from "forge-std/Test.sol";

import {PropertyToken} from "../../contracts/PropertyToken.sol";
import {MockV3Aggregator} from "../../contracts/test/MockV3Aggregator.sol";

contract PropertyTokenFuzzTest is Test {
    uint256 internal constant TOTAL_SUPPLY = 10_000 ether;
    uint256 internal constant ORACLE_MAX_AGE = 3 hours;
    int256 internal constant ETH_USD_PRICE = 3_000e8;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function _deploy() internal returns (PropertyToken token) {
        MockV3Aggregator oracle = new MockV3Aggregator(8, ETH_USD_PRICE);
        token = new PropertyToken(address(this), address(this), address(oracle), ORACLE_MAX_AGE);
        token.setWhitelisted(alice, true);
        token.setWhitelisted(bob, true);
    }

    function testFuzz_transferPreservesHistoricalEntitlements(
        uint96 rawAliceBalance,
        uint96 rawDeposit,
        uint96 rawTransfer
    ) public {
        PropertyToken token = _deploy();
        uint256 aliceBalance = bound(uint256(rawAliceBalance), 1 ether, TOTAL_SUPPLY / 2);
        uint256 deposit = bound(uint256(rawDeposit), 1 ether, 100 ether);

        assertTrue(token.transfer(alice, aliceBalance));
        vm.deal(address(this), deposit);
        token.depositYield{value: deposit}();

        uint256 aliceBefore = token.accumulativeYield(alice);
        uint256 bobBefore = token.accumulativeYield(bob);
        uint256 moved = bound(uint256(rawTransfer), 1, aliceBalance);

        vm.prank(alice);
        assertTrue(token.transfer(bob, moved));

        assertEq(token.accumulativeYield(alice), aliceBefore, "seller historical yield changed");
        assertEq(token.accumulativeYield(bob), bobBefore, "buyer inherited historical yield");
        assertEq(address(token).balance, deposit, "a transfer settled ETH");
    }

    function testFuzz_remainderCarryMatchesAggregateReference(uint96 rawA, uint96 rawB, uint96 rawC) public {
        PropertyToken token = _deploy();
        uint256 a = bound(uint256(rawA), 1, 100 ether);
        uint256 b = bound(uint256(rawB), 1, 100 ether);
        uint256 c = bound(uint256(rawC), 1, 100 ether);
        uint256 deposited = a + b + c;

        vm.deal(address(this), deposited);
        token.depositYield{value: a}();
        token.depositYield{value: b}();
        token.depositYield{value: c}();

        uint256 magnitude = token.MAGNITUDE();
        assertEq(token.totalYieldDeposited(), deposited);
        assertEq(token.magnifiedDividendPerShare(), Math.mulDiv(deposited, magnitude, TOTAL_SUPPLY));
        assertEq(token.magnifiedDividendRemainder(), mulmod(deposited, magnitude, TOTAL_SUPPLY));
    }

    function testFuzz_claimConservesDepositedFunds(uint96 rawShares, uint96 rawDeposit) public {
        PropertyToken token = _deploy();
        uint256 shares = bound(uint256(rawShares), 1 ether, TOTAL_SUPPLY - 1 ether);
        uint256 deposit = bound(uint256(rawDeposit), 1 ether, 100 ether);

        assertTrue(token.transfer(alice, shares));
        vm.deal(address(this), deposit);
        token.depositYield{value: deposit}();

        uint256 claimable = token.claimableYield(alice);
        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        token.claimYield();

        assertEq(token.withdrawnYield(alice), claimable);
        assertEq(token.totalYieldClaimed(), claimable);
        assertEq(alice.balance - balanceBefore, claimable);
        assertEq(address(token).balance + token.totalYieldClaimed(), token.totalYieldDeposited());
    }
}
