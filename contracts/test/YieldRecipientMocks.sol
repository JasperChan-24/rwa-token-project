// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IYieldToken {
    function claimYield() external;
}

contract ReentrantYieldRecipient {
    IYieldToken public immutable token;
    uint256 public receiveCount;
    bool public reentrySucceeded;

    constructor(address token_) {
        token = IYieldToken(token_);
    }

    function claim() external {
        token.claimYield();
    }

    receive() external payable {
        receiveCount += 1;
        (reentrySucceeded,) = address(token).call(abi.encodeCall(IYieldToken.claimYield, ()));
    }
}

contract RejectingYieldRecipient {
    IYieldToken public immutable token;

    constructor(address token_) {
        token = IYieldToken(token_);
    }

    function claim() external {
        token.claimYield();
    }

    receive() external payable {
        revert("ETH rejected");
    }
}
