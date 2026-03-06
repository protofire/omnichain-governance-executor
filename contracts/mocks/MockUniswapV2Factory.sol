// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract MockUniswapV2Factory {
    address public feeTo;
    address public feeToSetter;

    constructor() {
        feeToSetter = msg.sender;
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "UniswapV2: FORBIDDEN");
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, "UniswapV2: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }
}
