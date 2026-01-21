// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


contract MockUniswapV3Factory {
    address public owner;

    mapping(uint24 => int24) public feeAmountTickSpacing;
    mapping(address => mapping(address => mapping(uint24 => address)))
        public getPool;

    constructor() {
        owner = msg.sender;

        feeAmountTickSpacing[500] = 10;
        feeAmountTickSpacing[3000] = 60;
        feeAmountTickSpacing[10000] = 200;
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner);
        owner = _owner;
    }

    function enableFeeAmount(uint24 fee, int24 tickSpacing) public {
        require(msg.sender == owner);
        require(fee < 1000000);
        require(tickSpacing > 0 && tickSpacing < 16384);
        require(feeAmountTickSpacing[fee] == 0);

        feeAmountTickSpacing[fee] = tickSpacing;
    }
}
