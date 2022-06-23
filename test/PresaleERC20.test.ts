import { assert, expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { PresaleERC20 } from "../typechain-types/PresaleERC20";
import { MockPresaleERC20 } from "../typechain-types/MockPresaleERC20";
import { MockERC20 } from "../typechain-types/MockERC20";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("PresaleERC20", function () {
  let payToken: MockERC20;
  let buyToken: MockERC20;
  let presaleERC20: MockPresaleERC20;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let startTime: number;
  let endTime: number;
  let cliff: number;
  let vestingPeriod: number;
  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    const MockPayToken = await ethers.getContractFactory("MockERC20");
    payToken = (await MockPayToken.deploy("PAY", "PAY")) as MockERC20;
    await payToken.deployed();

    const MockBuyToken = await ethers.getContractFactory("MockERC20");
    buyToken = (await MockBuyToken.deploy("BUY", "BUY")) as MockERC20;
    await buyToken.deployed();

    const PresaleERC20 = await ethers.getContractFactory("MockPresaleERC20");
    startTime = Date.parse('21 Jun 2022 00:12:00 GMT') / 1000;

    endTime = startTime + 30 * 24 * 3600;
    presaleERC20 = (await PresaleERC20.deploy(payToken.address, buyToken.address, startTime, endTime)) as MockPresaleERC20;
    await presaleERC20.deployed();

    await buyToken.mint(presaleERC20.address, BigNumber.from("43750000000"));
    await buyToken.mint(owner.address, BigNumber.from("10000"));
    await payToken.mint(user1.address, 10000);
    await payToken.mint(user2.address, 10000);

    await payToken.connect(user1).approve(presaleERC20.address, 10000);
    await payToken.connect(user2).approve(presaleERC20.address, 10000);

    await buyToken.connect(owner).approve(presaleERC20.address, 10000);

    cliff = Date.parse('1 Aug 2022 00:12:00 GMT') / 1000;
    vestingPeriod = 48 * 30 * 24 * 3600;
  });
  it("test_initialization", async function () {
    expect(await buyToken.balanceOf(presaleERC20.address)).to.equal(BigNumber.from("43750000000"));

    expect(await presaleERC20.payToken()).to.equal(payToken.address);
    expect(await presaleERC20.buyToken()).to.equal(buyToken.address);
    expect(await presaleERC20.start()).to.equal(startTime);
    expect(await presaleERC20.deadline()).to.equal(endTime);
    expect(await presaleERC20.cliff()).to.equal(endTime);
    expect(await presaleERC20.lastClaimed()).to.equal(endTime);
  });

  it("test_setRange_asUser_thenReverted", async () => {
    await expect(presaleERC20.connect(user1).setRange(10, 100)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("test_setRange_asOwner_givenInValidRange_thenReverted", async () => {
    await expect(presaleERC20.connect(owner).setRange(100, 10)).to.be.revertedWith("set invalid range.");

    await expect(presaleERC20.connect(owner).setRange(0, 100)).to.be.revertedWith("set invalid range.");
  });

  it("test_setRange_asOwner_givenValidRange_thenSuccess", async () => {
    await presaleERC20.connect(owner);
    await presaleERC20.setRange(10, 100);

    expect(await presaleERC20.minAmount()).to.equal(10);
    expect(await presaleERC20.maxAmount()).to.equal(100);
  });

  it("test_setPrice_asUser_thenReverted", async () => {
    await expect(presaleERC20.connect(user1).setPrice(10)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("test_setPrice_asOwner_givenZeroPrice_thenReverted", async () => {
    await expect(presaleERC20.connect(owner).setPrice(0)).to.be.revertedWith("price is zero.");
  });

  it("test_setPrice_asOwner_givenValidPrice_thenSuccess", async () => {
    await (presaleERC20.connect(owner).setPrice(10));

    expect(await presaleERC20.price()).to.equal(10);
  });

  it("test_setVestingParameter_asUser_thenReverted", async () => {

    await expect(presaleERC20.connect(user1).setVestingParameter(vestingPeriod, cliff)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("test_setVestingParameter_asOwner_afterPresaleClosed_thenReverted", async () => {
    const twoMonths = 30 * 24 * 3600;
    const snapShot = await ethers.provider.send('evm_snapshot', []);
    await ethers.provider.send('evm_increaseTime', [twoMonths]);
    await ethers.provider.send('evm_mine', []);
    await expect(presaleERC20.connect(owner).setVestingParameter(vestingPeriod, cliff)).to.be.revertedWith("vesting parameter can't change");
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_setVestingParameter_asOwner_beforePresaleClosed_thenSuccess", async () => {
    await presaleERC20.connect(owner).setVestingParameter(vestingPeriod, cliff);
    expect(await presaleERC20.vestingPeriod()).to.equal(vestingPeriod);
    expect(await presaleERC20.cliff()).to.equal(cliff);
    expect(await presaleERC20.lastClaimed()).to.equal(cliff);
  });

  it("test_invest_notWhitelisted_thenReverted", async () => {

  });

  it("test_invest_afterPresaleClosed_thenReverted", async () => {
    const twoMonths = 30 * 24 * 3600;
    const snapShot = await ethers.provider.send('evm_snapshot', []);
    await ethers.provider.send('evm_increaseTime', [twoMonths]);
    await ethers.provider.send('evm_mine', []);
    await expect(presaleERC20.invest(100)).to.be.revertedWith("presale is closed.");
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_invest_givenLessThanMinAmount_thenReverted", async () => {
    await presaleERC20.connect(owner);
    await presaleERC20.setRange(10, 100);

    await expect(presaleERC20.invest(3)).to.be.revertedWith("fund is less than minimum amount.");
  });

  it("test_invest_givenMoreThanMaxAmount_thenReverted", async () => {
    await presaleERC20.connect(owner);
    await presaleERC20.setRange(10, 100);

    await expect(presaleERC20.invest(200)).to.be.revertedWith("fund is more than maximum amount.");
  });

  it("test_invest_givenValidAmount_thenSuccessAndEmitFundsTransferEvent", async () => {
    await presaleERC20.connect(owner);
    await presaleERC20.setRange(10, 100);

    await payToken.connect(user1).approve(presaleERC20.address, 10000);

    await presaleERC20.connect(owner).setPrice(100000000);
    const tx = await presaleERC20.connect(user1).invest(20);

    await expect(await presaleERC20.checkFundsPaid(user1.address)).to.equal(20);
    await expect(await presaleERC20.connect(owner).amountTotalPaid()).to.equal(20);
    await expect(await presaleERC20.checkFundsBuy(user1.address)).to.equal(20 * 100000000);
    await expect(await presaleERC20.connect(owner).amountTotalBought()).to.equal(20 * 100000000);
    await expect(tx).to.emit(presaleERC20, 'FundsTransfer').withArgs(user1.address, 20, true, 20);
  });

  it("test_invest_reachGoal_thenSuccessAndEmitGoalReachedEvent", async () => {
    await presaleERC20.connect(owner);
    await presaleERC20.setRange(10, 10000);

    await presaleERC20.connect(owner).setPrice(100000000);
    const tx = await presaleERC20.connect(user1).invest(4376);

    await expect(await presaleERC20.checkFundsPaid(user1.address)).to.equal(4376);
    await expect(await presaleERC20.connect(owner).amountTotalPaid()).to.equal(4376);
    await expect(await presaleERC20.checkFundsBuy(user1.address)).to.equal(4376 * 100000000);
    await expect(await presaleERC20.connect(owner).amountTotalBought()).to.equal(4376 * 100000000);
    await expect(tx).to.emit(presaleERC20, 'FundsTransfer').withArgs(user1.address, 4376, true, 4376);

    await expect(tx).to.emit(presaleERC20, 'GoalReached').withArgs(user1.address, 4376 * 100000000);
  });

  it("test_getClamiableAmount_beforePresaleClosed_thenReverted", async () => {
    await expect(await presaleERC20.presaleClosed()).to.be.false;
    const now = await presaleERC20.getTimestamp();
    const deadline = await presaleERC20.deadline();
    await expect(deadline.toNumber()).to.be.gt(now.toNumber());
    await expect(presaleERC20.connect(user2).getClaimableAmount()).to.be.revertedWith("presale is not closed.");
  });

  it("test_getClamiableAmount_zeroAmountPaid_thenReverted", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);
    const timeUntilPresaleClosed = endTime - Date.now() / 1000;
    await ethers.provider.send('evm_increaseTime', [timeUntilPresaleClosed]);
    await ethers.provider.send('evm_mine', []);

    await expect(presaleERC20.connect(user2).getClaimableAmount()).to.be.revertedWith("zero amount paid.");
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_getClamiableAmount_beforeCliff_thenReverted", async () => {
    await presaleERC20.connect(owner);
    await presaleERC20.setRange(10, 10000);
    await presaleERC20.setVestingParameter(vestingPeriod, cliff);

    await presaleERC20.connect(user2).invest(30);

    const snapShot = await ethers.provider.send('evm_snapshot', []);
    const timeUntilPresaleClosed = endTime - Date.now() / 1000;
    await ethers.provider.send('evm_increaseTime', [timeUntilPresaleClosed]);
    await ethers.provider.send('evm_mine', []);

    await expect(presaleERC20.connect(user2).getClaimableAmount()).to.be.revertedWith("claim is not available before cliff.");
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_getClamiableAmount_someAmountPaid_thenSuccess", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);

    await presaleERC20.connect(owner);
    await presaleERC20.setRange(10, 10000);
    await presaleERC20.setVestingParameter(vestingPeriod, cliff);
    await presaleERC20.setPrice(100000000);

    await presaleERC20.connect(user1).invest(20);

    const now = await presaleERC20.getTimestamp();
    const twoYearsAfterCliff = 24 * 30 * 24 * 3600 + cliff - now.toNumber();
    await ethers.provider.send('evm_increaseTime', [twoYearsAfterCliff]);
    await ethers.provider.send('evm_mine', []);

    const claimable = await presaleERC20.connect(user1).getClaimableAmount();
    expect(claimable).to.equal(1000000000);
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_claim_afterPresaleClosed_thenSuccess", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);

    await presaleERC20.connect(owner);
    await presaleERC20.setRange(10, 10000);
    await presaleERC20.setVestingParameter(vestingPeriod, cliff);
    await presaleERC20.setPrice(100000000);

    await presaleERC20.connect(user1).invest(20);

    const now = await presaleERC20.getTimestamp();
    const twoYearsAfterCliff = 24 * 30 * 24 * 3600 + cliff - now.toNumber();
    await ethers.provider.send('evm_increaseTime', [twoYearsAfterCliff]);
    await ethers.provider.send('evm_mine', []);

    await presaleERC20.connect(user1).claim();
    const balance = await buyToken.balanceOf(user1.address);
    assert.approximately(balance.toNumber(), 1000000000, 100);

    await ethers.provider.send('evm_increaseTime', [24 * 30 * 24 * 3600]);
    await ethers.provider.send('evm_mine', []);

    await presaleERC20.connect(user1).claim();

    await expect(await presaleERC20.checkFundsBuy(user1.address)).to.equal(0);
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_withdrawPayToken_asOwner_afterClosed_zeroPaidAmount_thenSuccess", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);

    await presaleERC20.connect(owner);
    await presaleERC20.setRange(10, 10000);
    await presaleERC20.setVestingParameter(vestingPeriod, cliff);
    await presaleERC20.setPrice(100000000);

    const now = await presaleERC20.getTimestamp();
    const twoYearsAfterCliff = 24 * 30 * 24 * 3600 + cliff - now.toNumber();
    await ethers.provider.send('evm_increaseTime', [twoYearsAfterCliff]);
    await ethers.provider.send('evm_mine', []);

    await expect(presaleERC20.withdrawPayToken()).to.be.revertedWith('withdraw paytoken amount is zero.');

    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_withdrawPayToken_asOwner_afterClosed_somePaidAmount_thenSuccess", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);

    await presaleERC20.connect(owner);
    await presaleERC20.setRange(10, 10000);
    await presaleERC20.setVestingParameter(vestingPeriod, cliff);
    await presaleERC20.setPrice(100000000);

    await presaleERC20.connect(user1).invest(20);

    const now = await presaleERC20.getTimestamp();
    const twoYearsAfterCliff = 24 * 30 * 24 * 3600 + cliff - now.toNumber();
    await ethers.provider.send('evm_increaseTime', [twoYearsAfterCliff]);
    await ethers.provider.send('evm_mine', []);

    await presaleERC20.withdrawPayToken();
    await expect((await payToken.balanceOf(owner.address)).toNumber()).to.equal(20);

    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_withdrawBuyToken_asOwner_afterClosed_thenSuccess", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);

    await presaleERC20.connect(owner);
    await presaleERC20.setRange(10, 10000);
    await presaleERC20.setVestingParameter(vestingPeriod, cliff);
    await presaleERC20.setPrice(100000000);

    await presaleERC20.connect(user1).invest(20);

    const now = await presaleERC20.getTimestamp();
    const twoYearsAfterCliff = 24 * 30 * 24 * 3600 + cliff - now.toNumber();
    await ethers.provider.send('evm_increaseTime', [twoYearsAfterCliff]);
    await ethers.provider.send('evm_mine', []);

    await presaleERC20.withdrawBuyToken();
    await expect((await buyToken.balanceOf(presaleERC20.address)).toNumber()).to.equal(2000000000);
    await expect((await buyToken.balanceOf(owner.address)).toNumber()).to.equal(41750010000);

    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_deposit_asOwner_givenZeroAmount_thenReverted", async () => {
    await expect(presaleERC20.deposit(0)).to.be.revertedWith('deposit amount is zero.');
  });

  it("test_deposit_asOwner_givenNonZeroAmount_thenSuccess", async () => {
    await presaleERC20.deposit(3000);
    await expect((await buyToken.balanceOf(owner.address)).toNumber()).to.equal(7000);
    await expect((await buyToken.balanceOf(presaleERC20.address)).toNumber()).to.equal(43750003000);
  })
});
