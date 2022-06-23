// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../PresaleETH.sol";

contract MockPresaleETH is PresaleETH {
	constructor(
		IERC20 _inkToken,
		uint256 _start,
		uint256 _deadline
	) PresaleETH(_inkToken, _start, _deadline) {}

	function getTimestamp() external view returns (uint256) {
		return block.timestamp;
	}
}
