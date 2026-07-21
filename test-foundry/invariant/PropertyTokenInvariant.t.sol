// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";

import {PropertyToken} from "../../contracts/PropertyToken.sol";
import {MockV3Aggregator} from "../../contracts/test/MockV3Aggregator.sol";
import {PropertyTokenHandler} from "./PropertyTokenHandler.sol";

contract PropertyTokenInvariantTest is StdInvariant, Test {
    uint256 internal constant ORACLE_MAX_AGE = 3 hours;
    int256 internal constant ETH_USD_PRICE = 3_000e8;

    PropertyToken internal token;
    PropertyTokenHandler internal handler;
    address[] internal actors;

    function setUp() public {
        actors.push(makeAddr("treasury"));
        actors.push(makeAddr("alice"));
        actors.push(makeAddr("bob"));
        actors.push(makeAddr("carol"));
        actors.push(makeAddr("dave"));

        MockV3Aggregator oracle = new MockV3Aggregator(8, ETH_USD_PRICE);
        token = new PropertyToken(address(this), actors[0], address(oracle), ORACLE_MAX_AGE);
        for (uint256 i = 1; i < actors.length; ++i) {
            token.setWhitelisted(actors[i], true);
        }

        handler = new PropertyTokenHandler(token, actors);
        token.grantRole(token.COMPLIANCE_ROLE(), address(handler));
        token.grantRole(token.DIVIDEND_DISTRIBUTOR_ROLE(), address(handler));
        token.grantRole(token.PAUSER_ROLE(), address(handler));

        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = PropertyTokenHandler.deposit.selector;
        selectors[1] = PropertyTokenHandler.transfer.selector;
        selectors[2] = PropertyTokenHandler.claim.selector;
        selectors[3] = PropertyTokenHandler.setWhitelisted.selector;
        selectors[4] = PropertyTokenHandler.setPaused.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function invariant_accountingAndSupplyConservation() public view {
        uint256 magnitude = token.MAGNITUDE();
        uint256 sumBalances;
        uint256 sumAccumulative;
        uint256 sumClaimable;
        uint256 sumWithdrawn;

        for (uint256 i = 0; i < actors.length; ++i) {
            address account = actors[i];
            uint256 accumulative = token.accumulativeYield(account);
            uint256 withdrawn = token.withdrawnYield(account);
            uint256 claimable = token.claimableYield(account);
            uint256 modeled = handler.modelMagnifiedAccrued(account) / magnitude;

            assertEq(accumulative, modeled, "entitlement diverged from shadow ledger");
            assertEq(withdrawn, handler.modelWithdrawn(account), "withdrawal ledger diverged");
            assertEq(claimable + withdrawn, accumulative, "claimable identity failed");
            assertLe(withdrawn, accumulative, "withdrawn exceeded entitlement");

            sumBalances += token.balanceOf(account);
            sumAccumulative += accumulative;
            sumClaimable += claimable;
            sumWithdrawn += withdrawn;
        }

        assertEq(sumBalances, token.totalSupply(), "fixed supply escaped actor set");
        assertEq(token.magnifiedDividendPerShare(), handler.modelMagnifiedDividendPerShare());
        assertEq(token.magnifiedDividendRemainder(), handler.modelRemainder());
        assertLt(token.magnifiedDividendRemainder(), token.totalSupply());

        assertEq(sumWithdrawn, token.totalYieldClaimed(), "claims did not match per-account withdrawals");
        assertEq(address(token).balance + token.totalYieldClaimed(), token.totalYieldDeposited());
        assertEq(sumClaimable + token.totalYieldClaimed(), sumAccumulative);
        assertLe(sumAccumulative, token.totalYieldDeposited(), "allocated more ETH than deposited");
        assertLe(token.totalYieldDeposited() - sumAccumulative, actors.length, "rounding dust exceeded bound");
    }
}
