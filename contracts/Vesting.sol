// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vesting is Ownable {
	using SafeERC20 for IERC20;

	struct Beneficiary {
		address wallet;
		uint256 duration;
		uint256 amount;
		uint256 claimed;
		string description;
	}

	event Claimed(address _beneficiary, uint256 amount);

	mapping(address => Beneficiary[]) public beneficiaries;
	address[] private vestingWallets;

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
		for (uint256 index = 0; index < vestingWallets.length; index++) {
			if (vestingWallets[index] == _beneficiary) return true;
		}
		return false;
	}

	function addBeneficiary(Beneficiary[] memory _beneficiaries)
		external
		onlyOwner
	{
		for (uint256 index = 0; index < _beneficiaries.length; index++) {
			Beneficiary memory _beneficiary = _beneficiaries[index];

			require(
				_beneficiary.wallet != address(0),
				"Vesting: beneficiary can not be address zero"
			);
			beneficiaries[_beneficiary.wallet].push(_beneficiary);
			if (!_exists(_beneficiary.wallet)) {
				vestingWallets.push(_beneficiary.wallet);
			}
			totalAmount += _beneficiary.amount;
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

		uint256[] memory _claimables = claimableAmount(_beneficiary);
		uint256 totalClaimed;
		for (uint256 index = 0; index < _claimables.length; index++) {
			if (_claimables[index] != 0) {
				beneficiaries[_beneficiary][index].claimed += _claimables[index];
				totalClaimed += _claimables[index];
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
			beneficiaries[_beneficiary].length
		);
		for (
			uint256 index = 0;
			index < beneficiaries[_beneficiary].length;
			index++
		) {
			uint256 duration = beneficiaries[_beneficiary][index].duration;
			uint256 amount = beneficiaries[_beneficiary][index].amount;
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
			index < beneficiaries[_beneficiary].length;
			index++
		) {
			claimables[index] -= beneficiaries[_beneficiary][index].claimed;
		}

		return claimables;
	}

	function wallets() external view returns (address[] memory) {
		return vestingWallets;
	}

	function beneficiariesByWallet(address _wallet)
		external
		view
		returns (Beneficiary[] memory)
	{
		return beneficiaries[_wallet];
	}

	function editByIndex(
		address _wallet,
		uint256 _index,
		Beneficiary memory _beneficiary
	) external onlyBeneficiaries(_wallet) {
		beneficiaries[_wallet][_index] = _beneficiary;
	}

	function deleteByIndex(address _wallet, uint256 _index)
		external
		onlyBeneficiaries(_wallet)
	{
		beneficiaries[_wallet][_index] = beneficiaries[_wallet][
			beneficiaries[_wallet].length - 1
		];
		beneficiaries[_wallet].pop();

		for (
			uint256 index = 0;
			index < beneficiaries[_wallet].length;
			index++
		) {
			if (beneficiaries[_wallet][index].amount != 0) return;
		}
		for (uint256 index = 0; index < vestingWallets.length; index++) {
			if (vestingWallets[index] == _wallet) {
				vestingWallets[index] = vestingWallets[vestingWallets.length - 1];
				vestingWallets.pop();
				return;
			}
		}
	}
}
