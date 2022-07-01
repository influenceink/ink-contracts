import { expect } from "chai";
import { ethers } from "hardhat";

import { BigNumber } from "ethers";
import { INK } from "../typechain-types";
import { StakingINK } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("StakingINK", function () {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let inkToken: INK;
  let stakingINK: StakingINK;
  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    const MockINKToken = await ethers.getContractFactory("INK");
    inkToken = (await MockINKToken.deploy()) as INK;
    await inkToken.deployed();

    const StakingINK = await ethers.getContractFactory("StakingINK");
    stakingINK = (await StakingINK.deploy(inkToken.address)) as StakingINK;
    await stakingINK.deployed();

    await inkToken.transfer(owner.address, 10000);
    await inkToken.transfer(user1.address, 10000);
    await inkToken.transfer(user2.address, 10000);

    await inkToken.connect(owner).approve(stakingINK.address, 10000);
    await inkToken.connect(user1).approve(stakingINK.address, 10000);
    await inkToken.connect(user2).approve(stakingINK.address, 10000);
  });

  it("test_setup", async function () {
    expect(await stakingINK.inkToken()).to.equal(inkToken.address);
  });

  it("test_addPlanInfo_asUser_thenReverted", async () => {
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 10;
    await expect(stakingINK.connect(user1).addPlanInfo(rewardPerBlock, lockingDuration)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("test_addPlanInfo_asOwner_givenInvalidLockingTime_thenReverted", async () => {
    const lockingDuration = 0;   // 0 days
    const rewardPerBlock = 10;
    await expect(stakingINK.addPlanInfo(rewardPerBlock, lockingDuration)).to.be.revertedWith("invalid locking time.");
  });

  it("test_addPlanInfo_asOwner_givenInvalidRewardPerBlock_thenReverted", async () => {
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 0;
    await expect(stakingINK.addPlanInfo(rewardPerBlock, lockingDuration)).to.be.revertedWith("invalid reward per block.");
  });

  it("test_addPlanInfo_asOwner_givenInvalidRewardPerBlock_thenSuccess", async () => {
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);
    const plan0 = await stakingINK.plans(0);
    expect(plan0.stakedAmountOfPlan).to.equal(0);
    expect(plan0.rewardPerBlock).to.equal(rewardPerBlock);
    expect(plan0.lockingDuration).to.equal(lockingDuration);
    expect(plan0.emergencyFlag).to.be.false;
  })
  it("test_removePlanInfo_asOwner_thenSuccess", async () => {

  });

  it("test_deposit_asOwner_givenZeroAmount_thenReverted", async () => {
    await expect(stakingINK.deposit(0)).to.be.revertedWith("diposit amount is zero.");
  });

  it("test_deposit_asOwner_givenValidAmount_thenSuccess", async () => {
    await stakingINK.deposit(50);
    expect(await inkToken.balanceOf(stakingINK.address)).to.equal(50);
  });

  it("test_setEmergencyFlag_asOwner_givenInvalidPlanId_thenReverted", async () => {
    await expect(stakingINK.setEmergencyFlag(1, true)).to.be.revertedWith("setEmergencyFlag: invalid plan ID.");
  });

  it("test_setEmergencyFlag_asOwner_givenValidPlanId_thenSuccess", async () => {
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);

    expect(await (await stakingINK.plans(0)).emergencyFlag).to.be.false;
    await stakingINK.setEmergencyFlag(0, true);
    expect(await (await stakingINK.plans(0)).emergencyFlag).to.be.true;
  });

  it("test_stake_givenInvalidPlanId_thenReverted", async () => {
    await expect(stakingINK.stake(1, 0)).to.be.revertedWith("stake: invalid plan ID.");
  });

  it("test_stake_givenInvalidAmount_thenReverted", async () => {
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);

    await expect(stakingINK.stake(0, 0)).to.be.revertedWith("stake: invalid amount.");
  });

  it("test_stake_givenValidAmountAndPlanId_alreadyStaked_thenReverted", async () => {
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);
    await stakingINK.stake(0, 10);

    await expect(stakingINK.stake(0, 20)).to.be.revertedWith("already staking in the plan.");
  });

  it("test_stake_givenValidAmountAndPlanId_thenSuccessAndEmitNewStakeEvent", async () => {
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);
    const tx = await stakingINK.connect(user1).stake(0, 10);
    expect(await inkToken.balanceOf(stakingINK.address)).to.equal(10);

    const blockNumber = await ethers.provider.getBlockNumber();
    const stakeInfo = await stakingINK.stakeLists(user1.address, 0);
    expect(await stakeInfo.stakedAmount).to.equal(10);
    expect(await stakeInfo.stakedBlock).to.equal(blockNumber);
    expect(await stakeInfo.claimedAmount).to.equal(0);

    await expect(tx).to.emit(stakingINK, 'NewStake').withArgs(user1.address, 10, blockNumber, 0);
  });

  it("test_getClaimableRewardAmount_givenInvalidPlanId_thenReturnZeroAmount", async () => {
    expect(await stakingINK.getClaimableRewardAmount(user1.address, 2)).to.equal(0);
  });

  it("test_getClaimableRewardAmount_notStaked_thenReturnZeroAmount", async () => {
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);

    expect(await stakingINK.getClaimableRewardAmount(user1.address, 0)).to.equal(0);
  });

  it("test_getClaimableRewardAmount_alreadyStaked_beforeLockingTime_thenReturnSomeReward", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);
    //const lockingDuration = 10 * 24 * 3600;   // 10 days
    const lockingDuration = 10;   // 10 days
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);

    await stakingINK.connect(user1).stake(0, 100);

    //const threeDays = 3 * 24 * 3600;
    //await ethers.provider.send('evm_increaseTime', [threeDays]);
    await ethers.provider.send('evm_mine', []);
    await ethers.provider.send('evm_mine', []);
    await ethers.provider.send('evm_mine', []);

    expect(await stakingINK.getClaimableRewardAmount(user1.address, 0)).to.equal(10 * 3);

    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_getClaimableRewardAmount_alreadyStaked_afterLockingTime_thenReturnFullReward", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);

    await stakingINK.connect(user1).stake(0, 100);

    const twelveDays = 12 * 24 * 3600;
    await ethers.provider.send('evm_increaseTime', [twelveDays]);
    await ethers.provider.send('evm_mine', []);

    expect(await stakingINK.getClaimableRewardAmount(user1.address, 0)).to.equal(10);

    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_claimReward_ifNoClaimable_thenReverted", async () => {
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);

    await stakingINK.connect(user1).stake(0, 100);

    await expect(stakingINK.claimReward(0)).to.be.revertedWith("claimable amount is zero.");
  });

  it("test_claimReward_ifClaimable_thenSuccessAndEmitNewClaimRewardEvent", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);
    const lockingDuration = 100;     // 100 block mining
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);

    await stakingINK.connect(user1).stake(0, 100);

    const twoDays = 2 * 24 * 3600;
    await ethers.provider.send('evm_increaseTime', [twoDays]);
    await ethers.provider.send('evm_mine', []);

    expect(await inkToken.balanceOf(user1.address)).to.equal(9900);
    await stakingINK.connect(user1).claimReward(0);
    expect(await inkToken.balanceOf(user1.address)).to.equal(9920);

    const threeDays = 3 * 24 * 3600;
    await ethers.provider.send('evm_increaseTime', [threeDays]);
    await ethers.provider.send('evm_mine', []);
    await ethers.provider.send('evm_mine', []);


    const tx = await stakingINK.connect(user1).claimReward(0);

    const blockNumber = await ethers.provider.getBlockNumber();

    expect(await inkToken.balanceOf(user1.address)).to.equal(9950);

    await expect(tx).to.emit(stakingINK, 'NewClaimReward').withArgs(user1.address, 30, blockNumber, 0);

    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_unstake_givenInvalidPlanId_theReverted", async () => {
    await expect(stakingINK.unstake(0)).to.be.revertedWith("unstake: invalid plan ID.");
  });

  it("test_unstake_zeroAmountStaked_theReverted", async () => {
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);
    await expect(stakingINK.unstake(0)).to.be.revertedWith("staked amount is zero.");
  });

  it("test_unstake_withNoEmergencyFlag_beforeLockingTime_thenReverted", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);

    await stakingINK.connect(user1).stake(0, 100);

    const twoDays = 2 * 24 * 3600;
    await ethers.provider.send('evm_increaseTime', [twoDays]);
    await ethers.provider.send('evm_mine', []);

    await expect(stakingINK.connect(user1).unstake(0)).to.be.revertedWith("unstake is not available.");

    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_unstake_afterLockingTime_thenSuccessAndEmitUnstakeEvent", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);
    const lockingDuration = 10;   // 10 blocks
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);

    await stakingINK.deposit(200);

    await stakingINK.connect(user1).stake(0, 100);

    const twelvetwoDays = 12 * 24 * 3600;
    await ethers.provider.send('evm_increaseTime', [twelvetwoDays]);

    for (let i = 0; i < 11; i++) {
      await ethers.provider.send('evm_mine', []);
    }

    const tx = await stakingINK.connect(user1).unstake(0);

    expect(await inkToken.balanceOf(user1.address)).to.equal(10100);
    expect(await inkToken.balanceOf(stakingINK.address)).to.equal(100);

    const blockNumber = await ethers.provider.getBlockNumber();

    await expect(tx).to.emit(stakingINK, 'UnStake').withArgs(user1.address, 200, blockNumber, 0);
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_unstake_withEmergencyFlag_beforeLockingTime_thenSuccessAndEmitEmergencyWithdrawEvent_withoutReward", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);
    const lockingDuration = 10 * 24 * 3600;   // 10 days
    const rewardPerBlock = 10;
    await stakingINK.addPlanInfo(rewardPerBlock, lockingDuration);

    await stakingINK.deposit(100);

    await stakingINK.connect(user1).stake(0, 100);

    const threeDays = 3 * 24 * 3600;
    await ethers.provider.send('evm_increaseTime', [threeDays]);
    await ethers.provider.send('evm_mine', []);
    await ethers.provider.send('evm_mine', []);

    await stakingINK.connect(user1).claimReward(0);
    await stakingINK.setEmergencyFlag(0, true);

    const tx = await stakingINK.connect(user1).unstake(0);

    expect(await inkToken.balanceOf(user1.address)).to.equal(10000);
    expect(await inkToken.balanceOf(stakingINK.address)).to.equal(100);

    const blockNumber = await ethers.provider.getBlockNumber();

    await expect(tx).to.emit(stakingINK, 'EmergencyWithdraw').withArgs(user1.address, 70, blockNumber, 0);
    await ethers.provider.send('evm_revert', [snapShot]);

  })
});
