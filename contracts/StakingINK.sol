// SPDX-License-Identifier: MIT

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

	struct PoolInfo {
		uint256 stakedAmountOfPool;
		uint256 rewardPerBlock;
		uint256 lockingDuration;
		bool emergencyFlag;
	}

	// Address of the INK Token contract
	IERC20 public inkToken;

	// Info of each stake with specific address and poolID
	mapping(address => mapping(uint256 => StakeInfo)) public stakeLists;

	// Info of each pool
	PoolInfo[] public pools;

	event NewStake(
		address _staker,
		uint256 _amount,
		uint256 _timestamp,
		uint256 _pid
	);
	event NewClaimReward(
		address _staker,
		uint256 _amount,
		uint256 _timestamp,
		uint256 _pid
	);
	event UnStake(
		address _staker,
		uint256 _amount,
		uint256 _timestamp,
		uint256 _pid
	);
	event EmergencyWithdraw(
		address _staker,
		uint256 _amount,
		uint256 _timestamp,
		uint256 _pid
	);

	modifier onlyWhitelisted(address _addr) {
		// implement whitelist logic
		_;
	}

	// initialization
	constructor(IERC20 _inkToken) {
		inkToken = _inkToken;
	}

	// add a new pool info. can only be called by the owner
	function addPoolInfo(uint256 _rewardPerBlock, uint256 _lockingDuration)
		external
		onlyOwner
	{
		require(_rewardPerBlock != 0, "invalid reward per block.");

		pools.push(
			PoolInfo({
				stakedAmountOfPool: 0,
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

	function setEmergencyFlag(uint256 _pid, bool flag) external onlyOwner {
		require(pools.length > _pid, "setEmergencyFlag: invalid pool ID.");
		pools[_pid].emergencyFlag = flag;
	}

	// stake INK token to specific pool by user
	function stake(uint256 _pid, uint256 _amount)
		external
		onlyWhitelisted(msg.sender)
	{
		require(pools.length > _pid, "stake: invalid pool ID.");
		require(_amount > 0, "stake: invalid amount.");
		StakeInfo storage stakeInfo = stakeLists[msg.sender][_pid];
		require(stakeInfo.stakedAmount == 0, "already staking in the pool.");

		pools[_pid].stakedAmountOfPool =
			pools[_pid].stakedAmountOfPool +
			_amount;
		inkToken.safeTransferFrom(msg.sender, address(this), _amount);

		stakeInfo.stakedAmount = _amount;
		stakeInfo.stakedBlock = block.number;
		stakeInfo.claimedAmount = 0;

		emit NewStake(msg.sender, _amount, stakeInfo.stakedBlock, _pid);
	}

	// unstake INK token with reward if available
	function unstake(uint256 _pid) external onlyWhitelisted(msg.sender) {
		require(pools.length > _pid, "unstake: invalid pool ID.");
		StakeInfo storage stakeInfo = stakeLists[msg.sender][_pid];
		require(stakeInfo.stakedAmount > 0, "staked amount is zero.");
		PoolInfo memory pool = pools[_pid];
		require(
			block.number >= pool.lockingDuration + stakeInfo.stakedBlock,
			"your fund is locked."
		);
		uint256 unstakeAmount = stakeInfo.stakedAmount +
			getClaimableRewardAmount(msg.sender, _pid);

		pools[_pid].stakedAmountOfPool =
			pools[_pid].stakedAmountOfPool -
			stakeInfo.stakedAmount;

		inkToken.safeTransfer(msg.sender, unstakeAmount);

		stakeInfo.stakedAmount = 0;
		stakeInfo.stakedBlock = 0;
		stakeInfo.claimedAmount = 0;

		emit UnStake(msg.sender, unstakeAmount, block.number, _pid);
	}

	// emergecy withdraw with penalty
	function emergencyWithdraw(uint256 _pid)
		external
		onlyWhitelisted(msg.sender)
	{
		require(pools.length > _pid, "emergecywithdraw: invalid pool ID.");
		StakeInfo storage stakeInfo = stakeLists[msg.sender][_pid];
		require(stakeInfo.stakedAmount > 0, "staked amount is zero.");
		PoolInfo memory pool = pools[_pid];
		require(pool.emergencyFlag == true, "emergency flag is not setted.");
		require(
			block.number < pool.lockingDuration + stakeInfo.stakedBlock,
			"your fund is unlocked."
		);
		uint256 unstakeAmount = stakeInfo.stakedAmount -
			stakeInfo.claimedAmount;

		pools[_pid].stakedAmountOfPool =
			pools[_pid].stakedAmountOfPool -
			stakeInfo.stakedAmount;

		inkToken.safeTransfer(msg.sender, unstakeAmount);

		stakeInfo.stakedAmount = 0;
		stakeInfo.stakedBlock = 0;
		stakeInfo.claimedAmount = 0;

		emit EmergencyWithdraw(msg.sender, unstakeAmount, block.number, _pid);
	}

	// claim reward INK tokens
	function claimReward(uint256 _pid) external onlyWhitelisted(msg.sender) {
		uint256 claimableAmount = getClaimableRewardAmount(msg.sender, _pid);

		require(claimableAmount > 0, "claimable amount is zero.");
		inkToken.safeTransfer(msg.sender, claimableAmount);

		StakeInfo storage stakeInfo = stakeLists[msg.sender][_pid];
		stakeInfo.claimedAmount = stakeInfo.claimedAmount + claimableAmount;

		emit NewClaimReward(msg.sender, claimableAmount, block.number, _pid);
	}

	function getClaimableRewardAmount(address _staker, uint256 _pid)
		public
		view
		returns (uint256)
	{
		if (pools.length <= _pid) return 0;
		PoolInfo memory pool = pools[_pid];
		uint256 rewardPerBlock = pool.rewardPerBlock;
		StakeInfo storage stakeInfo = stakeLists[_staker][_pid];
		if (stakeInfo.stakedAmount == 0) return 0;
		uint256 blockCount = block.number - stakeInfo.stakedBlock;
		if (blockCount >= pool.lockingDuration && pool.lockingDuration != 0) {
			blockCount = pool.lockingDuration;
		}

		uint256 claimableReward = ((blockCount *
			rewardPerBlock *
			stakeInfo.stakedAmount) / pool.stakedAmountOfPool) -
			stakeInfo.claimedAmount;
		return claimableReward;
	}

	function getAllPools() external view returns (PoolInfo[] memory) {
		return pools;
	}
}
