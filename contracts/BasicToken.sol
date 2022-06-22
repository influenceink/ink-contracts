// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Example class - a mock class using delivering from ERC20
contract BasicToken is ERC20 {
	constructor(uint256 initialBalance) ERC20("Infulence INK", "INK") {
		_mint(msg.sender, initialBalance);
	}
}
