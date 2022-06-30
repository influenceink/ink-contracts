// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vesting is Ownable {
	using SafeERC20 for IERC20;

	struct VestingInfo {
		uint256 duration;
		uint256 amount;
		uint256 claimed;
		string description;
	}

	event Claimed(address _beneficiary, uint256 amount);

	mapping(address => VestingInfo[]) public vestings;

	address public immutable vestingToken;

	uint256 public totalAmount;
	uint256 public totalClaimed;

	uint256 public immutable startTime;
	bool public paused;

	modifier onlyBeneficiaries(address _wallet) {
		require(_exists(_wallet), "Vesting: not beneficiary");
		_;
	}

	modifier checkArrayLengths(uint256 len0, uint256 len1) {
		require(len0 == len1, "Vesting: array lengths mismatch");
		_;
	}

	constructor(address _vestingToken, uint256 _startTime) {
		vestingToken = _vestingToken;
		startTime = _startTime;
	}

	function pause() external onlyOwner {
		paused = true;
	}

	function resume() external onlyOwner {
		paused = false;
	}

	function addVestings(
		address[] memory _wallets,
		VestingInfo[] memory _vestings
	)
		external
		onlyOwner
		checkArrayLengths(_wallets.length, _vestings.length)
	{
		for (uint256 i; i < _wallets.length; i++) {
			require(
				_wallets[i] != address(0),
				"Vesting: wallet is zero address"
			);
			vestings[_wallets[i]].push(_vestings[i]);
			totalAmount += _vestings[i].amount;
		}
	}

	function editVestings(
		address[] memory _wallets,
		uint256[] memory _indexes,
		VestingInfo[] memory _vestings
	)
		external
		onlyOwner
		checkArrayLengths(_wallets.length, _indexes.length)
		checkArrayLengths(_wallets.length, _vestings.length)
	{
		for (uint256 i; i < _wallets.length; i++) {
			address wallet = _wallets[i];
			uint256 index = _indexes[i];
			totalAmount -= vestings[wallet][index].amount;
			vestings[wallet][index] = _vestings[i];
			totalAmount += _vestings[i].amount;
		}
	}

	// indexes must be sorted by descending order
	function deleteVestings(
		address[] memory _wallets,
		uint256[] memory _indexes
	)
		external
		onlyOwner
		checkArrayLengths(_wallets.length, _indexes.length)
	{
		for (uint256 i; i < _wallets.length; i++) {
			address wallet = _wallets[i];
			uint256 index = _indexes[i];
			totalAmount -= vestings[wallet][index].amount;
			vestings[wallet][index] = vestings[wallet][
				vestings[wallet].length - 1
			];
			vestings[wallet].pop();
			if (vestings[wallet].length == 0) delete vestings[wallet];
		}
	}

	function claim(address _beneficiary)
		external
		onlyBeneficiaries(_beneficiary)
	{
		require(!paused, "Vesting: paused");

		uint256[] memory claimables = claimableAmount(_beneficiary);

		uint256 totalClaimable;
		for (uint256 i; i < claimables.length; i++) {
			if (claimables[i] != 0) {
				vestings[_beneficiary][i].claimed += claimables[i];
				totalClaimable += claimables[i];
			}
		}

		if (totalClaimable != 0) {
			IERC20(vestingToken).safeTransfer(_beneficiary, totalClaimable);
			totalClaimed += totalClaimable;
			emit Claimed(_beneficiary, totalClaimable);
		}
	}

	function unlockedAmount(address _beneficiary)
		public
		view
		returns (uint256[] memory)
	{
		if (!_exists(_beneficiary)) return new uint256[](0);

		uint256[] memory unlockedAmounts = new uint256[](
			vestings[_beneficiary].length
		);

		for (
			uint256 index = 0;
			index < vestings[_beneficiary].length;
			index++
		) {
			uint256 duration = vestings[_beneficiary][index].duration;
			uint256 amount = vestings[_beneficiary][index].amount;
			if (block.timestamp < startTime) {
				unlockedAmounts[index] = 0;
			} else if (block.timestamp > startTime + duration) {
				unlockedAmounts[index] = amount;
			} else {
				if (duration == 0) unlockedAmounts[index] = amount;
				unlockedAmounts[index] =
					(amount * (block.timestamp - startTime)) /
					duration;
			}
		}

		return unlockedAmounts;
	}

	function claimableAmount(address _beneficiary)
		public
		view
		returns (uint256[] memory)
	{
		uint256[] memory claimables = unlockedAmount(_beneficiary);
		for (uint256 index = 0; index < claimables.length; index++) {
			claimables[index] -= vestings[_beneficiary][index].claimed;
		}

		return claimables;
	}

	function _exists(address _beneficiary) internal view returns (bool) {
		return vestings[_beneficiary].length > 0;
	}

	function getVestingsOf(address _beneficiary)
		external
		view
		returns (VestingInfo[] memory)
	{
		return vestings[_beneficiary];
	}
}
