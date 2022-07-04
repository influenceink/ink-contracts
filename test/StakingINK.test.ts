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
  let user3: SignerWithAddress;
  let inkToken: INK;
  let stakingINK: StakingINK;
  const lockingDuration = 20;   // 20 blocks
  const rewardPerBlock = 10;

  beforeEach(async () => {
    [owner, user1, user2, user3] = await ethers.getSigners();

    const MockINKToken = await ethers.getContractFactory("INK");
    inkToken = (await MockINKToken.deploy()) as INK;
    await inkToken.deployed();

    const StakingINK = await ethers.getContractFactory("StakingINK");
    stakingINK = (await StakingINK.deploy(inkToken.address)) as StakingINK;
    await stakingINK.deployed();

    await inkToken.transfer(owner.address, 10000);
    await inkToken.transfer(user1.address, 10000);
    await inkToken.transfer(user2.address, 10000);
    await inkToken.transfer(user3.address, 10000);

    await inkToken.connect(owner).approve(stakingINK.address, 10000);
    await inkToken.connect(user1).approve(stakingINK.address, 10000);
    await inkToken.connect(user2).approve(stakingINK.address, 10000);
    await inkToken.connect(user3).approve(stakingINK.address, 10000);
  });

  it("test_setup", async function () {
    expect(await stakingINK.inkToken()).to.equal(inkToken.address);
  });

  it("test_addPoolInfo_asUser_thenReverts", async () => {

    await expect(stakingINK.connect(user1).addPoolInfo(rewardPerBlock, lockingDuration)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("test_addPoolInfo_asOwner_givenInvalidRewardPerBlock_thenReverts", async () => {
    await expect(stakingINK.addPoolInfo(0, lockingDuration)).to.be.revertedWith("invalid reward per block.");
  });

  it("test_addPoolInfo_asOwner_givenInvalidRewardPerBlock_thenSuccess", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);
    const pool0 = await stakingINK.pools(0);
    expect(pool0.stakedAmountOfPool).to.equal(0);
    expect(pool0.rewardPerBlock).to.equal(rewardPerBlock);
    expect(pool0.lockingDuration).to.equal(lockingDuration);
    expect(pool0.emergencyFlag).to.be.false;
  });

  it("test_deposit_asOwner_givenZeroAmount_thenReverts", async () => {
    await expect(stakingINK.deposit(0)).to.be.revertedWith("diposit amount is zero.");
  });

  it("test_deposit_asOwner_givenValidAmount_thenSuccess", async () => {
    await stakingINK.deposit(50);
    expect(await inkToken.balanceOf(stakingINK.address)).to.equal(50);
  });

  it("test_setEmergencyFlag_asOwner_givenInvalidPoolId_thenReverts", async () => {
    await expect(stakingINK.setEmergencyFlag(1, true)).to.be.revertedWith("setEmergencyFlag: invalid pool ID.");
  });

  it("test_setEmergencyFlag_asOwner_givenValidPoolId_thenSuccess", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    expect(await (await stakingINK.pools(0)).emergencyFlag).to.be.false;
    await stakingINK.setEmergencyFlag(0, true);
    expect(await (await stakingINK.pools(0)).emergencyFlag).to.be.true;
  });

  it("test_stake_givenInvalidPoolId_thenReverts", async () => {
    await expect(stakingINK.stake(1, 0)).to.be.revertedWith("stake: invalid pool ID.");
  });

  it("test_stake_givenInvalidAmount_thenReverts", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    await expect(stakingINK.stake(0, 0)).to.be.revertedWith("stake: invalid amount.");
  });

  it("test_stake_givenValidAmountAndPoolId_alreadyStaked_thenReverts", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);
    await stakingINK.stake(0, 10);

    await expect(stakingINK.stake(0, 20)).to.be.revertedWith("already staking in the pool.");
  });

  it("test_stake_givenValidAmountAndPoolId_thenSuccessAndEmitNewStakeEvent", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);
    const tx = await stakingINK.connect(user1).stake(0, 10);
    expect(await inkToken.balanceOf(stakingINK.address)).to.equal(10);

    const blockNumber = await ethers.provider.getBlockNumber();
    const stakeInfo = await stakingINK.stakeLists(user1.address, 0);
    expect(await stakeInfo.stakedAmount).to.equal(10);
    expect(await stakeInfo.stakedBlock).to.equal(blockNumber);
    expect(await stakeInfo.claimedAmount).to.equal(0);

    await expect(tx).to.emit(stakingINK, 'NewStake').withArgs(user1.address, 10, blockNumber, 0);
  });

  it("test_getClaimableRewardAmount_givenInvalidPoolId_thenReturnZeroAmount", async () => {
    expect(await stakingINK.getClaimableRewardAmount(user1.address, 2)).to.equal(0);
  });

  it("test_getClaimableRewardAmount_notStaked_thenReturnZeroAmount", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    expect(await stakingINK.getClaimableRewardAmount(user1.address, 0)).to.equal(0);
  });

  it("test_getClaimableRewardAmount_alreadyStaked_beforeLockingTime_thenReturnSomeReward", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    await stakingINK.connect(user1).stake(0, 100);

    await ethers.provider.send('evm_mine', []);
    await ethers.provider.send('evm_mine', []);
    await ethers.provider.send('evm_mine', []);

    expect(await stakingINK.getClaimableRewardAmount(user1.address, 0)).to.equal(10 * 3);
  });

  it("test_getClaimableRewardAmount_alreadyStaked_afterLockingTime_thenReturnFullReward", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    await stakingINK.connect(user1).stake(0, 100);

    await ethers.provider.send('evm_mine', []);

    expect(await stakingINK.getClaimableRewardAmount(user1.address, 0)).to.equal(10);
  });

  it("test_claimReward_ifNoClaimable_thenReverts", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    await stakingINK.connect(user1).stake(0, 100);

    await expect(stakingINK.claimReward(0)).to.be.revertedWith("claimable amount is zero.");
  });

  it("test_claimReward_ifClaimable_thenSuccessAndEmitNewClaimRewardEvent", async () => {
    const lockingDuration = 100;     // 100 block mining
    const rewardPerBlock = 10;
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    await stakingINK.connect(user1).stake(0, 100);

    await ethers.provider.send('evm_mine', []);

    expect(await inkToken.balanceOf(user1.address)).to.equal(9900);
    await stakingINK.connect(user1).claimReward(0);
    expect(await inkToken.balanceOf(user1.address)).to.equal(9920);

    const threeDays = 3 * 24 * 3600;
    await ethers.provider.send('evm_mine', []);
    await ethers.provider.send('evm_mine', []);


    const tx = await stakingINK.connect(user1).claimReward(0);

    const blockNumber = await ethers.provider.getBlockNumber();

    expect(await inkToken.balanceOf(user1.address)).to.equal(9950);

    await expect(tx).to.emit(stakingINK, 'NewClaimReward').withArgs(user1.address, 30, blockNumber, 0);
  });

  it("test_unstake_givenInvalidPoolId_thenReverts", async () => {
    await expect(stakingINK.unstake(0)).to.be.revertedWith("unstake: invalid pool ID.");
  });

  it("test_unstake_zeroAmountStaked_thenReverts", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);
    await expect(stakingINK.unstake(0)).to.be.revertedWith("staked amount is zero.");
  });

  it("test_unstake_beforeLockingTime_thenReverts", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    await stakingINK.connect(user1).stake(0, 100);

    await ethers.provider.send('evm_mine', []);

    await expect(stakingINK.connect(user1).unstake(0)).to.be.revertedWith("your fund is locked.");
  });

  it("test_unstake_afterLockingTime_thenSuccessAndEmitUnstakeEvent", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    await stakingINK.deposit(1000);

    await stakingINK.connect(user1).stake(0, 100);

    for (let i = 0; i < 21; i++) {
      await ethers.provider.send('evm_mine', []);
    }

    const tx = await stakingINK.connect(user1).unstake(0);

    expect(await inkToken.balanceOf(user1.address)).to.equal(10200);
    expect(await inkToken.balanceOf(stakingINK.address)).to.equal(800);

    const blockNumber = await ethers.provider.getBlockNumber();

    await expect(tx).to.emit(stakingINK, 'UnStake').withArgs(user1.address, 300, blockNumber, 0);
  });

  it("test_emergencyWithdraw_givenNotEmergencyFlag_beforeLockingDuration_thenReverts", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    await stakingINK.deposit(100);

    await stakingINK.connect(user1).stake(0, 100);

    await ethers.provider.send('evm_mine', []);
    await ethers.provider.send('evm_mine', []);

    await expect(stakingINK.connect(user1).emergencyWithdraw(0)).to.be.revertedWith("emergency flag is not setted.");

  });

  it("test_emergencyWithdraw_givenEmergencyFlag_afterLockingDuration_thenReverts", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    await stakingINK.deposit(100);
    await stakingINK.setEmergencyFlag(0, true);
    await stakingINK.connect(user1).stake(0, 100);

    for (let i = 0; i < 21; i++) {
      await ethers.provider.send('evm_mine', []);
    }

    await expect(stakingINK.connect(user1).emergencyWithdraw(0)).to.be.revertedWith("your fund is unlocked.");
  });

  it("test_emergencyWithdraw_givenEmergencyFlag_beforeLockingDuration_afterSomeAmountClaim_thenSuccessAndEmitEmergencyWithdrawEvent", async () => {
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    await stakingINK.deposit(100);

    await stakingINK.setEmergencyFlag(0, true);
    await stakingINK.connect(user1).stake(0, 100);

    await ethers.provider.send('evm_mine', []);
    await ethers.provider.send('evm_mine', []);
    await ethers.provider.send('evm_mine', []);

    await stakingINK.connect(user1).claimReward(0);
    const tx = await stakingINK.connect(user1).emergencyWithdraw(0);
    const blockNumber = await ethers.provider.getBlockNumber();
    await expect(tx).to.emit(stakingINK, 'EmergencyWithdraw').withArgs(user1.address, 60, blockNumber, 0);

    expect(await inkToken.balanceOf(user1.address)).to.equal(10000);
    expect(await inkToken.balanceOf(stakingINK.address)).to.equal(100);
  });

  it("test_final_fullScenario", async () => {
    // plan[0]: rewardPerBlock=10, lockingDuration=10
    await stakingINK.addPoolInfo(rewardPerBlock, lockingDuration);

    // plan[1]: rewardPerBlock=20, lockingDuration=0
    await stakingINK.addPoolInfo(20, 0);

    await stakingINK.connect(user1).stake(0, 100);
    await stakingINK.connect(user1).stake(1, 300);

    await stakingINK.connect(user2).stake(0, 1000);
    const startBlock_user2_pool1 = await ethers.provider.getBlockNumber();
    await stakingINK.connect(user2).stake(1, 5000);

    await stakingINK.connect(user3).stake(0, 400);

    const plan0 = await stakingINK.pools(0);
    const plan1 = await stakingINK.pools(1);

    expect(plan0.stakedAmountOfPool).to.equal(1500);
    expect(plan1.stakedAmountOfPool).to.equal(5300);

    let expectedBalance = Math.floor(4000 + 20 * ((await ethers.provider.getBlockNumber()) - startBlock_user2_pool1) * 5000 / 5300);
    await stakingINK.connect(user2).claimReward(1);
    expect(await inkToken.balanceOf(user2.address)).to.equal(expectedBalance);

    expectedBalance = Math.floor(9000 + 20 * ((await ethers.provider.getBlockNumber()) - startBlock_user2_pool1) * 5000 / 5300);
    await stakingINK.connect(user2).unstake(1);   // unstake at any time in plan1(lockingDuration=0)
    expect(await inkToken.balanceOf(user2.address)).to.equal(expectedBalance);

    await expect(stakingINK.connect(user1).unstake(0)).to.be.revertedWith("your fund is locked.");  // can't unstake at locking duration

    await stakingINK.setEmergencyFlag(0, true);
    expect(await inkToken.balanceOf(user3.address)).to.equal(9600);
    await stakingINK.connect(user3).claimReward(0);
    expect(await inkToken.balanceOf(user3.address)).to.equal(9613);     // some reward received
    await stakingINK.connect(user3).emergencyWithdraw(0);
    expect(await inkToken.balanceOf(user3.address)).to.equal(10000);    // (original staked amount - received reward)
  });
});
