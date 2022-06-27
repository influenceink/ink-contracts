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

	event Claimed(address _beneficiary, uint256 amount);
	event NewBeneficiaryAdded(
		address _beneficiary,
		uint256 _duration,
		uint256 _totalAmount
	);

	mapping(address => Beneficiary) public beneficiaries;

	address public vestingToken;
	uint256 public totalAmount;
	uint256 public totalClaimed;
	uint256 public immutable startTime;
	bool public paused;

	modifier onlyMembers(address _beneficiary) {
		require(
			beneficiaries[_beneficiary].totalAmount != 0,
			"Vesting: not member"
		);
		_;
	}

	constructor(
		address _token,
		uint256 _amount,
		uint256 _startTime
	) {
		vestingToken = _token;
		totalAmount = _amount;
		startTime = _startTime;

		totalClaimed = 0;
		paused = false;
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
		require(
			beneficiaries[_beneficiary].totalAmount == 0,
			"Vesting: already exists"
		);
		beneficiaries[_beneficiary] = Beneficiary(_duration, _amount, 0);

		emit NewBeneficiaryAdded(_beneficiary, _duration, _amount);
	}

	function pause() external onlyOwner {
		paused = true;
	}

	function resume() external onlyOwner {
		paused = false;
	}

	function claim(address _beneficiary) external onlyMembers(_beneficiary) {
		require(!paused, "Vesting is paused.");

		uint256 _claimable = claimableAmount(_beneficiary);

		require(
			totalAmount >= totalClaimed + _claimable,
			"The total amount is overspent."
		);

		totalClaimed += _claimable;
		beneficiaries[_beneficiary].claimed += _claimable;

		require(_claimable != 0, "Vesting: already claimed all");

		SafeERC20.safeTransfer(IERC20(vestingToken), _beneficiary, _claimable);

		emit Claimed(_beneficiary, _claimable);
	}

	function unlockedAmount(address _beneficiary)
		public
		view
		onlyMembers(_beneficiary)
		returns (uint256)
	{
		uint256 _duration = beneficiaries[_beneficiary].duration;
		uint256 _amount = beneficiaries[_beneficiary].totalAmount;
		if (block.timestamp < startTime) {
			return 0;
		} else if (block.timestamp > startTime + _duration) {
			return _amount;
		} else {
			if (_duration == 0) return _amount;
			return (_amount * (block.timestamp - startTime)) / _duration;
		}
	}

	function claimableAmount(address _beneficiary)
		public
		view
		onlyMembers(_beneficiary)
		returns (uint256)
	{
		return
			unlockedAmount(_beneficiary) - beneficiaries[_beneficiary].claimed;
	}
}
