// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../PresaleERC20.sol";

contract MockPresaleERC20 is PresaleERC20 {
	constructor(
		IERC20 _payToken,
		IERC20 _buyToken,
		uint256 _start,
		uint256 _deadline
	) PresaleERC20(_payToken, _buyToken, _start, _deadline) {}

	function getTimestamp() external view returns (uint256) {
		return block.timestamp;
	}
}
