import { assert, expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { PresaleETH } from "../typechain-types/PresaleETH";
import { MockERC20 } from "../typechain-types/MockERC20";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("presaleETH", function () {
  let inkToken: MockERC20;
  let presaleETH: PresaleETH;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let startTime: number;
  let endTime: number;
  let vestingCliff: number;
  let vestingDuration: number;
  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    const MockPayToken = await ethers.getContractFactory("MockERC20");
    inkToken = (await MockPayToken.deploy("PAY", "PAY")) as MockERC20;
    await inkToken.deployed();

    const PresaleETH = await ethers.getContractFactory("PresaleETH");
    startTime = Date.parse('21 Jun 2022 00:12:00 GMT') / 1000;

    endTime = startTime + 30 * 24 * 3600;
    vestingCliff = Date.parse('1 Aug 2022 00:12:00 GMT') / 1000;
    vestingDuration = 48 * 30 * 24 * 3600;

    presaleETH = (await PresaleETH.deploy(inkToken.address, startTime, endTime, vestingCliff)) as PresaleETH;
    await presaleETH.deployed();

    await inkToken.mint(presaleETH.address, ethers.utils.parseEther("43750000000"));
    await inkToken.mint(owner.address, ethers.utils.parseEther("10000"));

    //await payToken.connect(user1).approve(presaleETH.address, 10000);
    //await payToken.connect(user2).approve(presaleETH.address, 10000);


    await inkToken.connect(owner).approve(presaleETH.address, ethers.utils.parseEther("10000"));
  });

  it("test_setup", async function () {
    expect(await inkToken.balanceOf(presaleETH.address)).to.equal(ethers.utils.parseEther("43750000000"));

    const privKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    let wallet = await new ethers.Wallet(privKey, ethers.provider);
    const tx = await wallet.sendTransaction({ to: presaleETH.address, value: ethers.utils.parseEther("2000") })
    const expectBalance = await ethers.provider.getBalance(owner.address);
    assert.approximately(expectBalance.div(ethers.utils.parseEther("0.001")).toNumber(), 8000000, 1000)
    //expect(await ethers.provider.getBalance(owner.address)).to.equal(ethers.utils.parseEther("8000"));
    expect(await ethers.provider.getBalance(presaleETH.address)).to.equal(ethers.utils.parseEther("2000"));
    expect(await presaleETH.inkToken()).to.equal(inkToken.address);
    expect(await presaleETH.startTime()).to.equal(startTime);
    expect(await presaleETH.endTime()).to.equal(endTime);
    expect(await presaleETH.vestingCliff()).to.equal(vestingCliff);
  });

  it("test_setPayRange_asUser_thenReverts", async () => {
    await expect(presaleETH.connect(user1).setPayRange(10, 100)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("test_setPayRange_asOwner_givenInValidRange_thenReverts", async () => {
    await expect(presaleETH.connect(owner).setPayRange(100, 10)).to.be.revertedWith("set invalid range.");

    await expect(presaleETH.connect(owner).setPayRange(0, 100)).to.be.revertedWith("set invalid range.");
  });

  it("test_setPayRange_asOwner_givenValidRange_thenSuccess", async () => {
    await presaleETH.connect(owner);
    await presaleETH.setPayRange(10, 100);

    expect(await presaleETH.minPayAmount()).to.equal(10);
    expect(await presaleETH.maxPayAmount()).to.equal(100);
  });

  it("test_setPrice_asUser_thenReverts", async () => {
    await expect(presaleETH.connect(user1).setPrice(10)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("test_setPrice_asOwner_givenZeroPrice_thenReverts", async () => {
    await expect(presaleETH.connect(owner).setPrice(0)).to.be.revertedWith("price is zero.");
  });

  it("test_setPrice_asOwner_givenValidPrice_thenSuccess", async () => {
    await (presaleETH.connect(owner).setPrice(10));

    expect(await presaleETH.price()).to.equal(10);
  });

  it("test_setVestingParameter_asUser_thenReverts", async () => {

    await expect(presaleETH.connect(user1).setVestingParameter(vestingDuration, vestingCliff)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("test_setVestingParameter_asOwner_afterPresaleClosed_thenReverts", async () => {
    const twoMonths = 30 * 24 * 3600;
    const snapShot = await ethers.provider.send('evm_snapshot', []);
    await ethers.provider.send('evm_increaseTime', [twoMonths]);
    await ethers.provider.send('evm_mine', []);
    await expect(presaleETH.connect(owner).setVestingParameter(vestingDuration, vestingCliff)).to.be.revertedWith("vesting parameter can't change");
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_setVestingParameter_asOwner_givenInvalidCliff_thenReverts", async () => {
    await expect(presaleETH.connect(owner).setVestingParameter(vestingDuration, startTime - 1)).to.be.revertedWith("vesting parameter can't change");
  });

  it("test_setVestingParameter_asOwner_beforePresaleClosed_thenSuccess", async () => {
    await presaleETH.connect(owner).setVestingParameter(vestingDuration, vestingCliff);
    expect(await presaleETH.vestingDuration()).to.equal(vestingDuration);
    expect(await presaleETH.vestingCliff()).to.equal(vestingCliff);
  });

  it("test_invest_notWhitelisted_thenReverts", async () => {

  });

  it("test_invest_afterPresaleClosed_thenReverts", async () => {
    const twoMonths = 30 * 24 * 3600;
    const snapShot = await ethers.provider.send('evm_snapshot', []);
    await ethers.provider.send('evm_increaseTime', [twoMonths]);
    await ethers.provider.send('evm_mine', []);
    await expect(presaleETH.invest({ value: ethers.utils.parseEther("100") })).to.be.revertedWith("presale is closed.");
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_invest_givenLessThanMinPayAmount_thenReverts", async () => {
    await presaleETH.connect(owner);
    await presaleETH.setPayRange(ethers.utils.parseEther("10"), ethers.utils.parseEther("100"));

    await expect(presaleETH.invest({ value: ethers.utils.parseEther("3") })).to.be.revertedWith("fund is out of range.");
  });

  it("test_invest_givenMoreThanMaxPayAmount_thenReverts", async () => {
    await presaleETH.connect(owner);
    await presaleETH.setPayRange(ethers.utils.parseEther("10"), ethers.utils.parseEther("100"));

    await expect(presaleETH.invest({ value: ethers.utils.parseEther("200") })).to.be.revertedWith("fund is out of range.");
  });

  it("test_invest_givenValidAmount_thenSuccessAndEmitFundsInvestedEvent", async () => {
    await presaleETH.connect(owner);
    await presaleETH.setPayRange(ethers.utils.parseEther("10"), ethers.utils.parseEther("100"));

    await presaleETH.connect(owner).setPrice(100000000);
    const tx = await presaleETH.connect(user1).invest({ value: ethers.utils.parseEther("20") });

    await expect(await presaleETH.balanceOfETH(user1.address)).to.equal(ethers.utils.parseEther("20"));
    await expect(await presaleETH.connect(owner).amountRaisedETH()).to.equal(ethers.utils.parseEther("20"));
    await expect(await presaleETH.balanceOfINK(user1.address)).to.equal(ethers.utils.parseEther("2000000000"));
    await expect(await presaleETH.connect(owner).amountRaisedINK()).to.equal(ethers.utils.parseEther("2000000000"));
    await expect(tx).to.emit(presaleETH, 'FundsInvested').withArgs(user1.address, ethers.utils.parseEther("20"));
  });

  it("test_invest_reachGoal_thenSuccessAndEmitGoalReachedEvent", async () => {
    await presaleETH.connect(owner);
    await presaleETH.setPayRange(ethers.utils.parseEther("10"), ethers.utils.parseEther("10000"));

    await presaleETH.connect(owner).setPrice(100000000);
    const tx = await presaleETH.connect(user1).invest({ value: ethers.utils.parseEther("4376") });

    await expect(await presaleETH.balanceOfETH(user1.address)).to.equal(ethers.utils.parseEther("4376"));
    await expect(await presaleETH.connect(owner).amountRaisedETH()).to.equal(ethers.utils.parseEther("4376"));
    await expect(await presaleETH.balanceOfINK(user1.address)).to.equal(ethers.utils.parseEther("437600000000"));
    await expect(await presaleETH.connect(owner).amountRaisedINK()).to.equal(ethers.utils.parseEther("437600000000"));
    await expect(tx).to.emit(presaleETH, 'FundsInvested').withArgs(user1.address, ethers.utils.parseEther("4376"));

    await expect(tx).to.emit(presaleETH, 'GoalReached').withArgs(ethers.utils.parseEther("437600000000"));
  });

  it("test_getClamiableAmount_zeroAmountPaid_thenReturnZero", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);
    const timeUntilPresaleClosed = endTime - Date.now() / 1000;
    await ethers.provider.send('evm_increaseTime', [timeUntilPresaleClosed]);
    await ethers.provider.send('evm_mine', []);

    expect(await presaleETH.getClaimableAmount(user2.address)).to.equal(0);
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_getClamiableAmount_beforeCliff_thenReturnZero", async () => {
    await presaleETH.connect(owner);
    await presaleETH.setPayRange(ethers.utils.parseEther("10"), ethers.utils.parseEther("10000"));
    await presaleETH.setVestingParameter(vestingDuration, vestingCliff);

    await presaleETH.connect(user2).invest({ value: ethers.utils.parseEther("30") });

    const snapShot = await ethers.provider.send('evm_snapshot', []);
    const timeUntilPresaleClosed = endTime - Date.now() / 1000;
    await ethers.provider.send('evm_increaseTime', [timeUntilPresaleClosed]);
    await ethers.provider.send('evm_mine', []);

    expect(await presaleETH.getClaimableAmount(user2.address)).to.equal(0);
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_getClamiableAmount_someAmountPaid_thenSuccess", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);

    await presaleETH.connect(owner);
    await presaleETH.setPayRange(ethers.utils.parseEther("10"), ethers.utils.parseEther("10000"));
    await presaleETH.setVestingParameter(vestingDuration, vestingCliff);
    await presaleETH.setPrice(100000000);

    await presaleETH.connect(user1).invest({ value: ethers.utils.parseEther("20") });

    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    const twoYearsAfterCliff = 24 * 30 * 24 * 3600 + vestingCliff - block.timestamp;
    await ethers.provider.send('evm_increaseTime', [twoYearsAfterCliff]);
    await ethers.provider.send('evm_mine', []);

    const claimable = await presaleETH.getClaimableAmount(user1.address);
    expect(claimable).to.equal(ethers.utils.parseEther("1000000000"));
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_claim_claimableAmountIsZero_thenReverts", async () => {
    await presaleETH.connect(owner);
    await presaleETH.setPayRange(ethers.utils.parseEther("10"), ethers.utils.parseEther("10000"));
    await presaleETH.setVestingParameter(vestingDuration, vestingCliff);

    await presaleETH.connect(user2).invest({ value: ethers.utils.parseEther("30") });

    const snapShot = await ethers.provider.send('evm_snapshot', []);
    const timeUntilPresaleClosed = endTime - Date.now() / 1000;
    await ethers.provider.send('evm_increaseTime', [timeUntilPresaleClosed]);
    await ethers.provider.send('evm_mine', []);

    await expect(presaleETH.connect(user2).claim()).to.be.revertedWith('claimable amount is zero.');
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_claim_afterPresaleClosed_thenSuccess", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);

    await presaleETH.connect(owner);
    await presaleETH.setPayRange(ethers.utils.parseEther("10"), ethers.utils.parseEther("10000"));
    await presaleETH.setVestingParameter(vestingDuration, vestingCliff);
    await presaleETH.setPrice(100000000);

    await presaleETH.connect(user1).invest({ value: ethers.utils.parseEther("20") });

    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    const twoYearsAfterCliff = 24 * 30 * 24 * 3600 + vestingCliff - block.timestamp;
    await ethers.provider.send('evm_increaseTime', [twoYearsAfterCliff]);
    await ethers.provider.send('evm_mine', []);

    await presaleETH.connect(user1).claim();
    const balance = await inkToken.balanceOf(user1.address);
    assert.approximately(balance.div(ethers.utils.parseEther("1")).toNumber(), 1000000000, 100);

    await ethers.provider.send('evm_increaseTime', [24 * 30 * 24 * 3600]);
    await ethers.provider.send('evm_mine', []);

    await presaleETH.connect(user1).claim();

    await expect(await presaleETH.balanceOfINK(user1.address)).to.equal(0);
    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_withdrawETH_asOwner_afterClosed_zeroPaidAmount_thenSuccess", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);

    await presaleETH.connect(owner);
    await presaleETH.setPayRange(ethers.utils.parseEther("10"), ethers.utils.parseEther("10000"));
    await presaleETH.setVestingParameter(vestingDuration, vestingCliff);
    await presaleETH.setPrice(100000000);

    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    const twoYearsAfterCliff = 24 * 30 * 24 * 3600 + vestingCliff - block.timestamp;
    await ethers.provider.send('evm_increaseTime', [twoYearsAfterCliff]);
    await ethers.provider.send('evm_mine', []);

    await expect(presaleETH.withdrawETH()).to.be.revertedWith('withdraw ETH amount is zero.');

    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_withdrawETH_asOwner_afterClosed_somePaidAmount_thenSuccess", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);

    await presaleETH.connect(owner);
    await presaleETH.setPayRange(ethers.utils.parseEther("10"), ethers.utils.parseEther("10000"));
    await presaleETH.setVestingParameter(vestingDuration, vestingCliff);
    await presaleETH.setPrice(100000000);

    await presaleETH.connect(user1).invest({ value: ethers.utils.parseEther("20") });

    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);

    const twoYearsAfterCliff = 24 * 30 * 24 * 3600 + vestingCliff - block.timestamp;
    await ethers.provider.send('evm_increaseTime', [twoYearsAfterCliff]);
    await ethers.provider.send('evm_mine', []);

    const balanceBeforeWithdraw = await owner.getBalance();
    const tx = await presaleETH.withdrawETH();
    //const gas = tx.gasPrice as BigNumber;
    const balanceAfterWithdraw = await owner.getBalance();

    //expect(balanceAfterWithdraw.sub(balanceBeforeWithdraw).sub(gas)).to.equal(ethers.utils.parseEther("20"));
    const expectBalance = balanceAfterWithdraw.sub(balanceBeforeWithdraw);
    assert.approximately(expectBalance.div(ethers.utils.parseEther("0.001")).toNumber(), 20000, 10);

    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_withdrawinkToken_asOwner_afterClosed_thenSuccess", async () => {
    const snapShot = await ethers.provider.send('evm_snapshot', []);

    await presaleETH.connect(owner);
    await presaleETH.setPayRange(ethers.utils.parseEther("10"), ethers.utils.parseEther("10000"));
    await presaleETH.setVestingParameter(vestingDuration, vestingCliff);
    await presaleETH.setPrice(100000000);

    await presaleETH.connect(user1).invest({ value: ethers.utils.parseEther("20") });

    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    const twoYearsAfterCliff = 24 * 30 * 24 * 3600 + vestingCliff - block.timestamp;
    await ethers.provider.send('evm_increaseTime', [twoYearsAfterCliff]);
    await ethers.provider.send('evm_mine', []);

    await presaleETH.withdrawInkToken();
    await expect((await inkToken.balanceOf(presaleETH.address)).div(ethers.utils.parseEther("1")).toNumber()).to.equal(2000000000);
    await expect((await inkToken.balanceOf(owner.address)).div(ethers.utils.parseEther("1")).toNumber()).to.equal(41750010000);

    await ethers.provider.send('evm_revert', [snapShot]);
  });

  it("test_deposit_asOwner_givenZeroAmount_thenReverts", async () => {
    await expect(presaleETH.deposit(0)).to.be.revertedWith('deposit amount is zero.');
  });

  it("test_deposit_asOwner_givenNonZeroAmount_thenSuccess", async () => {
    await presaleETH.deposit(ethers.utils.parseEther("3000"));
    await expect((await inkToken.balanceOf(owner.address))).to.equal(ethers.utils.parseEther("7000"));
    await expect((await inkToken.balanceOf(presaleETH.address))).to.equal(ethers.utils.parseEther("43750003000"));
  })
});
