// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vesting {
	struct Beneficiary {
		uint256 duration;
		uint256 allocation;
		uint256 claimed;
	}
	event INKClaimed(address _vestingWallet, uint256 amount);

	address private defaultINK;

	mapping(address => Beneficiary) private _vestingWallets;
	uint256 private immutable _startTime;
	uint256 private immutable _cliff;

	constructor(uint256 _startTimeStamp, uint256 _cliffSeconds) {
		_cliff = _cliffSeconds;
		_startTime = _startTimeStamp;
	}

	function addVestingWallet(
		address _vestingWallet,
		uint256 _duration,
		uint256 _allocation
	) external {
		require(
			_vestingWallet != address(0),
			"Vesting: Beneficiary can not be address zero."
		);
		_vestingWallets[_vestingWallet] = Beneficiary(
			_duration,
			_allocation,
			0
		);
	}

	function start() public view returns (uint256) {
		return _startTime;
	}

	function duration(address _vestingWallet) public view returns (uint256) {
		return _vestingWallets[_vestingWallet].duration;
	}

	function claimed(address _vestingWallet)
		external
		view
		returns (uint256)
	{
		return _vestingWallets[_vestingWallet].claimed;
	}

	function claim(address _vestingWallet) external {
		uint256 claimable = _vestedAmount(
			_vestingWallet,
			uint64(block.timestamp)
		) - _vestingWallets[_vestingWallet].claimed;

		_vestingWallets[_vestingWallet].claimed += claimable;
		emit INKClaimed(_vestingWallet, claimable);
		SafeERC20.safeTransfer(IERC20(defaultINK), _vestingWallet, claimable);
	}

	function _vestedAmount(address _vestingWallet, uint64 timeStamp)
		internal
		view
		returns (uint256)
	{
		uint256 _duration = _vestingWallets[_vestingWallet].duration;
		uint256 _allocation = _vestingWallets[_vestingWallet].allocation;
		if (timeStamp < _startTime) {
			return 0;
		} else if (timeStamp > _startTime + _duration) {
			return _allocation;
		} else {
			return (_allocation * (timeStamp - _startTime)) / _duration;
		}
	}
}
