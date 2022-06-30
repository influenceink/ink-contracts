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
		string description;
	}

	event Claimed(address _beneficiary, uint256 amount);

	mapping(address => Beneficiary[]) public vestings;

	address public immutable vestingToken;
	uint256 public totalAmount;
	uint256 public immutable startTime;
	bool public paused;

	modifier onlyBeneficiaries(address _wallet) {
		require(_exists(_wallet), "Vesting: not beneficiary");
		_;
	}

	constructor(address _token, uint256 _startTime) {
		vestingToken = _token;
		startTime = _startTime;
	}

	function _exists(address _beneficiary) internal view returns (bool) {
		return vestings[_beneficiary].length > 0;
	}

	function addVestings(
		address[] memory _wallets,
		Beneficiary[] memory _beneficiaries
	) external onlyOwner {
		require(
			_wallets.length == _beneficiaries.length,
			"Vesting: both have different length"
		);
		for (uint256 index = 0; index < _wallets.length; index++) {
			require(
				_wallets[index] != address(0),
				"Vesting: beneficiary can not be address zero"
			);
			vestings[_wallets[index]].push(_beneficiaries[index]);
			totalAmount += _beneficiaries[index].amount;
		}
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

		uint256[] memory claimables = claimableAmount(_beneficiary);
		uint256 totalClaimed;
		for (uint256 index = 0; index < claimables.length; index++) {
			if (claimables[index] != 0) {
				vestings[_beneficiary][index].claimed += claimables[index];
				totalClaimed += claimables[index];
			}
		}
		if (totalClaimed != 0) {
			IERC20(vestingToken).safeTransfer(_beneficiary, totalClaimed);
			emit Claimed(_beneficiary, totalClaimed);
		}
	}

	function unlockedAmount(address _beneficiary)
		public
		view
		onlyBeneficiaries(_beneficiary)
		returns (uint256[] memory)
	{
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
		onlyBeneficiaries(_beneficiary)
		returns (uint256[] memory)
	{
		uint256[] memory claimables = unlockedAmount(_beneficiary);
		for (
			uint256 index = 0;
			index < vestings[_beneficiary].length;
			index++
		) {
			claimables[index] -= vestings[_beneficiary][index].claimed;
		}

		return claimables;
	}

	function getVestingsOf(address _beneficiary)
		external
		view
		onlyBeneficiaries(_beneficiary)
		returns (Beneficiary[] memory)
	{
		return vestings[_beneficiary];
	}

	function editByIndex(
		address _wallet,
		uint256 _index,
		Beneficiary memory _beneficiary
	) external onlyBeneficiaries(_wallet) {
		require(
			_index >= 0 && _index < vestings[_wallet].length,
			"Vesting: index is out of range"
		);
		vestings[_wallet][_index] = _beneficiary;
	}

	function deleteByIndex(address _wallet, uint256 _index)
		external
		onlyBeneficiaries(_wallet)
	{
		require(
			_index >= 0 && _index < vestings[_wallet].length,
			"Vesting: index is out of range"
		);
		vestings[_wallet][_index] = vestings[_wallet][
			vestings[_wallet].length - 1
		];
		vestings[_wallet].pop();

		if (vestings[_wallet].length == 0) delete vestings[_wallet];
	}
}
