// SPDXLicense-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract StakingINK is Ownable {
	using SafeERC20 for IERC20;

	// Info of each staker
	struct StakeInfo {
		uint256 stakedAmount; // how may INK tokens the user has staked
		uint256 stakedBlock; // the time when add staking amount
		uint256 claimedAmount; // reward amounts user has claimed
	}

	struct PlanInfo {
		uint256 stakedAmountOfPlan;
		uint256 rewardPerBlock;
		uint256 lockingDuration;
		bool emergencyFlag;
	}

	// Address of the INK Token contract
	IERC20 public inkToken;

	// Info of each stake with specific address and planID
	mapping(address => mapping(uint256 => StakeInfo)) public stakeLists;

	// Info of each plan
	PlanInfo[] public plans;

	event NewStake(
		address _staker,
		uint256 _amount,
		uint256 _timestamp,
		uint256 _planId
	);
	event NewClaimReward(
		address _staker,
		uint256 _amount,
		uint256 _timestamp,
		uint256 _planId
	);
	event UnStake(
		address _staker,
		uint256 _amount,
		uint256 _timestamp,
		uint256 _planId
	);
	event EmergencyWithdraw(
		address _staker,
		uint256 _amount,
		uint256 _timestamp,
		uint256 _planId
	);

	modifier onlyWhitelisted(address _addr) {
		// implement whitelist logic
		_;
	}

	// initialization
	constructor(IERC20 _inkToken) {
		inkToken = _inkToken;
	}

	// add a new plan info. can only be called by the owner
	function addPlanInfo(uint256 _rewardPerBlock, uint256 _lockingDuration)
		external
		onlyOwner
	{
		require(_lockingDuration != 0, "invalid locking time.");
		require(_rewardPerBlock != 0, "invalid reward per block.");

		plans.push(
			PlanInfo({
				stakedAmountOfPlan: 0,
				rewardPerBlock: _rewardPerBlock,
				lockingDuration: _lockingDuration,
				emergencyFlag: false
			})
		);
	}

	// deposit INK token for reward by owner
	function deposit(uint256 _amount) external onlyOwner {
		require(_amount > 0, "diposit amount is zero.");
		inkToken.safeTransferFrom(msg.sender, address(this), _amount);
	}

	function setEmergencyFlag(uint256 _planId, bool flag)
		external
		onlyOwner
	{
		require(plans.length > _planId, "setEmergencyFlag: invalid plan ID.");
		plans[_planId].emergencyFlag = flag;
	}

	// stake INK token to specific plan by user
	function stake(uint256 _planId, uint256 _amount)
		external
		onlyWhitelisted(msg.sender)
	{
		require(plans.length > _planId, "stake: invalid plan ID.");
		require(_amount > 0, "stake: invalid amount.");
		StakeInfo storage stakeInfo = stakeLists[msg.sender][_planId];
		require(stakeInfo.stakedAmount == 0, "already staking in the plan.");

		plans[_planId].stakedAmountOfPlan =
			plans[_planId].stakedAmountOfPlan +
			_amount;
		inkToken.safeTransferFrom(msg.sender, address(this), _amount);

		stakeInfo.stakedAmount = _amount;
		stakeInfo.stakedBlock = block.number;
		stakeInfo.claimedAmount = 0;

		emit NewStake(msg.sender, _amount, stakeInfo.stakedBlock, _planId);
	}

	// unstake INK token with reward if available
	function unstake(uint256 _planId) external onlyWhitelisted(msg.sender) {
		require(plans.length > _planId, "unstake: invalid plan ID.");
		StakeInfo storage stakeInfo = stakeLists[msg.sender][_planId];
		require(stakeInfo.stakedAmount > 0, "staked amount is zero.");
		PlanInfo memory plan = plans[_planId];
		uint256 unstakeAmount = 0;
		bool emergencyFlag = false;
		if (block.number >= plan.lockingDuration + stakeInfo.stakedBlock) {
			unstakeAmount =
				stakeInfo.stakedAmount +
				getClaimableRewardAmount(msg.sender, _planId);
		} else {
			if (plan.emergencyFlag == true) {
				unstakeAmount = stakeInfo.stakedAmount - stakeInfo.claimedAmount;
				emergencyFlag = true;
			}
		}
		require(unstakeAmount > 0, "unstake is not available.");

		plans[_planId].stakedAmountOfPlan =
			plans[_planId].stakedAmountOfPlan +
			stakeInfo.stakedAmount;

		inkToken.safeTransfer(msg.sender, unstakeAmount);

		stakeInfo.stakedAmount = 0;
		stakeInfo.stakedBlock = 0;
		stakeInfo.claimedAmount = 0;

		if (emergencyFlag == true) {
			emit EmergencyWithdraw(
				msg.sender,
				unstakeAmount,
				block.number,
				_planId
			);
		} else {
			emit UnStake(msg.sender, unstakeAmount, block.number, _planId);
		}
	}

	// claim reward INK tokens
	function claimReward(uint256 _planId)
		external
		onlyWhitelisted(msg.sender)
	{
		uint256 claimableAmount = getClaimableRewardAmount(
			msg.sender,
			_planId
		);

		require(claimableAmount > 0, "claimable amount is zero.");
		inkToken.safeTransfer(msg.sender, claimableAmount);

		StakeInfo storage stakeInfo = stakeLists[msg.sender][_planId];
		stakeInfo.claimedAmount = stakeInfo.claimedAmount + claimableAmount;

		emit NewClaimReward(
			msg.sender,
			claimableAmount,
			block.number,
			_planId
		);
	}

	function getClaimableRewardAmount(address _staker, uint256 _planId)
		public
		view
		returns (uint256)
	{
		if (plans.length <= _planId) return 0;
		PlanInfo memory plan = plans[_planId];
		uint256 rewardPerBlock = plan.rewardPerBlock;
		StakeInfo storage stakeInfo = stakeLists[_staker][_planId];
		if (stakeInfo.stakedAmount == 0) return 0;
		uint256 blockCount = block.number - stakeInfo.stakedBlock;
		if (blockCount >= plan.lockingDuration) {
			blockCount = plan.lockingDuration;
		}

		uint256 claimableReward = ((blockCount *
			rewardPerBlock *
			stakeInfo.stakedAmount) / plan.stakedAmountOfPlan) -
			stakeInfo.claimedAmount;
		return claimableReward;
	}

	function getAllPlans() external view returns (PlanInfo[] memory) {
		return plans;
	}
}
