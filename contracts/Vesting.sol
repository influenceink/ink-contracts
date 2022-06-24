// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vesting is Ownable {
	struct Beneficiary {
		uint256 duration;
		uint256 totalAmount;
		uint256 claimed;
	}
	event INKClaimed(address _beneficiary, uint256 amount);

	address private vestingToken;

	mapping(address => Beneficiary) public vestingWallets;

	uint256 private _totalAmount;
	uint256 private _totalReleased;
	uint256 public immutable startTime;
	bool private _paused;

	constructor(
		address _token,
		uint256 _amount,
		uint256 _startTime
	) {
		vestingToken = _token;
		_totalAmount = _amount;
		startTime = _startTime;

		_totalReleased = 0;
		_paused = false;
	}

	function addBeneficiary(
		address _beneficiary,
		uint256 _duration,
		uint256 _amount
	) external onlyOwner {
		require(
			_beneficiary != address(0),
			"Vesting: Beneficiary can not be address zero."
		);
		vestingWallets[_beneficiary] = Beneficiary(_duration, _amount, 0);
	}

	function pause() external onlyOwner {
		_paused = true;
	}

	function resume() external onlyOwner {
		_paused = false;
	}

	function claim(address _beneficiary) external {
		require(!_paused, "Vesting is paused.");

		uint256 claimable = vestedAmount(_beneficiary) -
			vestingWallets[_beneficiary].claimed;

		require(
			_totalAmount >= _totalReleased + claimable,
			"The total amount is overspent."
		);

		_totalReleased += claimable;
		vestingWallets[_beneficiary].claimed += claimable;

		SafeERC20.safeTransfer(IERC20(vestingToken), _beneficiary, claimable);

		emit INKClaimed(_beneficiary, claimable);
	}

	function vestedAmount(address _beneficiary)
		public
		view
		returns (uint256)
	{
		uint256 _duration = vestingWallets[_beneficiary].duration;
		uint256 _amount = vestingWallets[_beneficiary].totalAmount;
		if (block.timestamp < startTime) {
			return 0;
		} else if (block.timestamp > startTime + _duration) {
			return _amount;
		} else {
			return (_amount * (block.timestamp - startTime)) / _duration;
		}
	}
}
