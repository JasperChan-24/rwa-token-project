// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Test} from "forge-std/Test.sol";

import {PropertyToken} from "../../contracts/PropertyToken.sol";

/// @dev A bounded state-machine driver with an independent, correction-free
/// shadow ledger. Only the fixed actor set can ever hold tokens or claim yield.
contract PropertyTokenHandler is Test {
    PropertyToken public immutable token;

    address[] internal _actors;
    uint256 public modelMagnifiedDividendPerShare;
    uint256 public modelRemainder;
    mapping(address account => uint256 magnifiedAmount) public modelMagnifiedAccrued;
    mapping(address account => uint256 withdrawn) public modelWithdrawn;

    uint256 public successfulDeposits;
    uint256 public successfulTransfers;
    uint256 public successfulClaims;
    uint256 public allowlistChanges;
    uint256 public pauseChanges;

    constructor(PropertyToken token_, address[] memory actors_) {
        token = token_;
        _actors = actors_;
    }

    function actors() external view returns (address[] memory) {
        return _actors;
    }

    function deposit(uint96 rawAmount) external {
        if (token.paused()) return;

        uint256 amount = bound(uint256(rawAmount), 1, 10 ether);
        uint256 supply = token.totalSupply();
        uint256 magnitude = token.MAGNITUDE();
        uint256 increment = Math.mulDiv(amount, magnitude, supply);
        uint256 combinedRemainder = mulmod(amount, magnitude, supply) + modelRemainder;
        increment += combinedRemainder / supply;

        modelRemainder = combinedRemainder % supply;
        modelMagnifiedDividendPerShare += increment;
        for (uint256 i = 0; i < _actors.length; ++i) {
            address account = _actors[i];
            modelMagnifiedAccrued[account] += Math.mulDiv(increment, token.balanceOf(account), 1);
        }

        vm.deal(address(this), amount);
        token.depositYield{value: amount}();
        ++successfulDeposits;
    }

    function transfer(uint256 rawFrom, uint256 rawTo, uint96 rawAmount) external {
        if (token.paused()) return;

        uint256 fromIndex = rawFrom % _actors.length;
        uint256 toIndex = rawTo % _actors.length;
        if (fromIndex == toIndex) toIndex = (toIndex + 1) % _actors.length;

        address from = _actors[fromIndex];
        address to = _actors[toIndex];
        if (!token.isWhitelisted(from) || !token.isWhitelisted(to)) return;

        uint256 balance = token.balanceOf(from);
        if (balance == 0) return;

        uint256 amount = bound(uint256(rawAmount), 1, balance);
        vm.prank(from);
        assertTrue(token.transfer(to, amount));
        ++successfulTransfers;
    }

    function claim(uint256 rawActor) external {
        address account = _actors[rawActor % _actors.length];
        if (!token.isWhitelisted(account)) return;

        uint256 amount = token.claimableYield(account);
        if (amount == 0) return;

        modelWithdrawn[account] += amount;
        vm.prank(account);
        token.claimYield();
        ++successfulClaims;
    }

    function setWhitelisted(uint256 rawActor, bool allowed) external {
        address account = _actors[rawActor % _actors.length];
        if (token.isWhitelisted(account) == allowed) return;

        token.setWhitelisted(account, allowed);
        ++allowlistChanges;
    }

    function setPaused(bool shouldPause) external {
        if (token.paused() == shouldPause) return;

        if (shouldPause) {
            token.pause();
        } else {
            token.unpause();
        }
        ++pauseChanges;
    }
}
