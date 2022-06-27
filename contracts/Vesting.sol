// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vesting is Ownable {
	using SafeERC20 for IERC20;

	struct Beneficiary {
		uint256 duration;
		uint256 amount;
		uint256 claimed;
	}

	event Claimed(address _beneficiary, uint256 amount);
	event NewBeneficiaryAdded(
		address _beneficiary,
		uint256 _duration,
		uint256 _totalAmount
	);

	mapping(address => Beneficiary) public beneficiaries;

	address public immutable vestingToken;
	uint256 public totalAmount;
	uint256 public totalClaimed;
	uint256 public immutable startTime;
	bool public paused;

	modifier onlyBeneficiaries(address _wallet) {
		require(
			beneficiaries[_wallet].amount != 0,
			"Vesting: not beneficiary"
		);
		_;
	}

	constructor(address _token, uint256 _startTime) {
		vestingToken = _token;
		startTime = _startTime;
	}

	function addBeneficiary(
		address _beneficiary,
		uint256 _duration,
		uint256 _amount
	) external onlyOwner {
		require(
			_beneficiary != address(0),
			"Vesting: beneficiary can not be address zero"
		);
		require(
			beneficiaries[_beneficiary].amount == 0,
			"Vesting: already exists"
		);
		beneficiaries[_beneficiary] = Beneficiary(_duration, _amount, 0);
		totalAmount += _amount;

		emit NewBeneficiaryAdded(_beneficiary, _duration, _amount);
	}

	function pause() external onlyOwner {
		paused = true;
	}

	function resume() external onlyOwner {
		paused = false;
	}

	function claim(address _beneficiary)
		external
		onlyBeneficiaries(_beneficiary)
	{
		require(!paused, "Vesting: paused");

		uint256 claimable = claimableAmount(_beneficiary);

		require(claimable != 0, "Vesting: already claimed all");

		totalClaimed += claimable;
		beneficiaries[_beneficiary].claimed += claimable;

		IERC20(vestingToken).safeTransfer(_beneficiary, claimable);

		emit Claimed(_beneficiary, claimable);
	}

	function unlockedAmount(address _beneficiary)
		public
		view
		onlyBeneficiaries(_beneficiary)
		returns (uint256)
	{
		uint256 duration = beneficiaries[_beneficiary].duration;
		uint256 amount = beneficiaries[_beneficiary].amount;
		if (block.timestamp < startTime) {
			return 0;
		} else if (block.timestamp > startTime + duration) {
			return amount;
		} else {
			if (duration == 0) return amount;
			return (amount * (block.timestamp - startTime)) / duration;
		}
	}

	function claimableAmount(address _beneficiary)
		public
		view
		onlyBeneficiaries(_beneficiary)
		returns (uint256)
	{
		return
			unlockedAmount(_beneficiary) - beneficiaries[_beneficiary].claimed;
	}
}
