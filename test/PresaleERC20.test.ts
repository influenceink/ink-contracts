import { assert, expect } from "chai"
import { BigNumber } from "ethers"
import { ethers } from "hardhat"
import { PresaleERC20 } from "../typechain-types/PresaleERC20"
import { INK } from "../typechain-types/INK"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

describe("PresaleERC20", function () {
	let payToken: INK
	let buyToken: INK
	let presaleERC20: PresaleERC20
	let owner: SignerWithAddress
	let user1: SignerWithAddress
	let user2: SignerWithAddress
	let startTime: number
	let endTime: number
	let vestingCliff: number
	let vestingDuration: number
	beforeEach(async () => {
		;[owner, user1, user2] = await ethers.getSigners()

		const MockPayToken = await ethers.getContractFactory("INK")
		payToken = (await MockPayToken.deploy()) as INK
		await payToken.deployed()

		const MockBuyToken = await ethers.getContractFactory("INK")
		buyToken = (await MockBuyToken.deploy()) as INK
		await buyToken.deployed()

		const PresaleERC20 = await ethers.getContractFactory("PresaleERC20")
		startTime = Date.parse("21 Jun 2022 00:12:00 GMT") / 1000

		endTime = startTime + 30 * 24 * 3600

		vestingCliff = Date.parse("1 Aug 2022 00:12:00 GMT") / 1000
		vestingDuration = 48 * 30 * 24 * 3600

		presaleERC20 = (await PresaleERC20.deploy(
			payToken.address,
			buyToken.address,
			startTime,
			endTime,
			vestingCliff
		)) as PresaleERC20
		await presaleERC20.deployed()

		await buyToken.transfer(
			presaleERC20.address,
			BigNumber.from("43750000000")
		)
		await payToken.transfer(user1.address, 10000)
		await payToken.transfer(user2.address, 10000)

		await payToken.connect(user1).approve(presaleERC20.address, 10000)
		await payToken.connect(user2).approve(presaleERC20.address, 10000)

		await buyToken.connect(owner).approve(presaleERC20.address, 10000)
	})

	it("test_setup", async function () {
		expect(await buyToken.balanceOf(presaleERC20.address)).to.equal(
			BigNumber.from("43750000000")
		)

		expect(await presaleERC20.payToken()).to.equal(payToken.address)
		expect(await presaleERC20.buyToken()).to.equal(buyToken.address)
		expect(await presaleERC20.startTime()).to.equal(startTime)
		expect(await presaleERC20.endTime()).to.equal(endTime)
		expect(await presaleERC20.vestingCliff()).to.equal(vestingCliff)
	})

	it("test_setPayRange_asUser_thenReverts", async () => {
		await expect(
			presaleERC20.connect(user1).setPayRange(10, 100)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it("test_setPayRange_asOwner_givenInValidRange_thenReverts", async () => {
		await expect(
			presaleERC20.connect(owner).setPayRange(100, 10)
		).to.be.revertedWith("set invalid range.")

		await expect(
			presaleERC20.connect(owner).setPayRange(0, 100)
		).to.be.revertedWith("set invalid range.")
	})

	it("test_setPayRange_asOwner_givenValidRange_thenSuccess", async () => {
		await presaleERC20.connect(owner)
		await presaleERC20.setPayRange(10, 100)

		expect(await presaleERC20.minPayAmount()).to.equal(10)
		expect(await presaleERC20.maxPayAmount()).to.equal(100)
	})

	it("test_setPrice_asUser_thenReverts", async () => {
		await expect(
			presaleERC20.connect(user1).setPrice(10)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it("test_setPrice_asOwner_givenZeroPrice_thenReverts", async () => {
		await expect(
			presaleERC20.connect(owner).setPrice(0)
		).to.be.revertedWith("price is zero.")
	})

	it("test_setPrice_asOwner_givenValidPrice_thenSuccess", async () => {
		await presaleERC20.connect(owner).setPrice(10)

		expect(await presaleERC20.price()).to.equal(10)
	})

	it("test_setVestingParameter_asUser_thenReverts", async () => {
		await expect(
			presaleERC20
				.connect(user1)
				.setVestingParameter(vestingDuration, vestingCliff)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it("test_setVestingParameter_asOwner_afterPresaleClosed_thenReverts", async () => {
		const twoMonths = 30 * 24 * 3600
		const snapShot = await ethers.provider.send("evm_snapshot", [])
		await ethers.provider.send("evm_increaseTime", [twoMonths])
		await ethers.provider.send("evm_mine", [])
		await expect(
			presaleERC20
				.connect(owner)
				.setVestingParameter(vestingDuration, vestingCliff)
		).to.be.revertedWith("vesting parameter can't change.")
		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_setVestingParameter_asOwner_givenInvalidCliff_thenReverts", async () => {
		await expect(
			presaleERC20
				.connect(owner)
				.setVestingParameter(vestingDuration, startTime - 1)
		).to.be.revertedWith("vesting parameter can't change.")
	})

	it("test_setVestingParameter_asOwner_beforePresaleClosed_thenSuccess", async () => {
		await presaleERC20
			.connect(owner)
			.setVestingParameter(vestingDuration, vestingCliff)
		expect(await presaleERC20.vestingDuration()).to.equal(vestingDuration)
		expect(await presaleERC20.vestingCliff()).to.equal(vestingCliff)
	})

	it("test_invest_notWhitelisted_thenReverts", async () => {})

	it("test_invest_afterPresaleClosed_thenReverts", async () => {
		const twoMonths = 30 * 24 * 3600
		const snapShot = await ethers.provider.send("evm_snapshot", [])
		await ethers.provider.send("evm_increaseTime", [twoMonths])
		await ethers.provider.send("evm_mine", [])
		await expect(presaleERC20.invest(100)).to.be.revertedWith(
			"presale is closed."
		)
		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_invest_givenLessThanminPayAmount_thenReverts", async () => {
		await presaleERC20.connect(owner)
		await presaleERC20.setPayRange(10, 100)

		await expect(presaleERC20.invest(3)).to.be.revertedWith(
			"fund is out of range."
		)
	})

	it("test_invest_givenMoreThanmaxPayAmount_thenReverts", async () => {
		await presaleERC20.connect(owner)
		await presaleERC20.setPayRange(10, 100)

		await expect(presaleERC20.invest(200)).to.be.revertedWith(
			"fund is out of range."
		)
	})

	it("test_invest_givenValidAmount_thenSuccessAndEmitFundsInvestedEvent", async () => {
		await presaleERC20.connect(owner)
		await presaleERC20.setPayRange(10, 100)

		await payToken.connect(user1).approve(presaleERC20.address, 10000)

		await presaleERC20.connect(owner).setPrice(100000000)
		const tx = await presaleERC20.connect(user1).invest(20)

		await expect(await presaleERC20.balanceOfPay(user1.address)).to.equal(
			20
		)
		await expect(
			await presaleERC20.connect(owner).amountTotalPaid()
		).to.equal(20)
		await expect(await presaleERC20.balanceOfBuy(user1.address)).to.equal(
			20 * 100000000
		)
		await expect(
			await presaleERC20.connect(owner).amountTotalBought()
		).to.equal(20 * 100000000)
		await expect(tx)
			.to.emit(presaleERC20, "FundsInvested")
			.withArgs(user1.address, 20)
	})

	it("test_invest_reachGoal_thenSuccessAndEmitGoalReachedEvent", async () => {
		await presaleERC20.connect(owner)
		await presaleERC20.setPayRange(10, 10000)

		await presaleERC20
			.connect(owner)
			.setPrice(ethers.utils.parseEther("100000000"))
		const tx = await presaleERC20.connect(user1).invest(4376)

		await expect(await presaleERC20.balanceOfPay(user1.address)).to.equal(
			4376
		)
		await expect(
			await presaleERC20.connect(owner).amountTotalPaid()
		).to.equal(4376)
		await expect(await presaleERC20.balanceOfBuy(user1.address)).to.equal(
			ethers.utils.parseEther("437600000000")
		)
		await expect(
			await presaleERC20.connect(owner).amountTotalBought()
		).to.equal(ethers.utils.parseEther("437600000000"))
		await expect(tx)
			.to.emit(presaleERC20, "FundsInvested")
			.withArgs(user1.address, 4376)

		await expect(tx)
			.to.emit(presaleERC20, "GoalReached")
			.withArgs(ethers.utils.parseEther("437600000000"))
	})

	it("test_getClamiableAmount_zeroAmountPaid_thenReturnZero", async () => {
		const snapShot = await ethers.provider.send("evm_snapshot", [])
		const timeUntilPresaleClosed = endTime - Date.now() / 1000
		await ethers.provider.send("evm_increaseTime", [
			timeUntilPresaleClosed,
		])
		await ethers.provider.send("evm_mine", [])

		expect(await presaleERC20.getClaimableAmount(user2.address)).to.equal(
			0
		)
		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_getClamiableAmount_beforeCliff_thenReturnZero", async () => {
		await presaleERC20.connect(owner)
		await presaleERC20.setPayRange(10, 10000)
		await presaleERC20.setVestingParameter(vestingDuration, vestingCliff)

		await presaleERC20.connect(user2).invest(30)

		const snapShot = await ethers.provider.send("evm_snapshot", [])
		const timeUntilPresaleClosed = endTime - Date.now() / 1000
		await ethers.provider.send("evm_increaseTime", [
			timeUntilPresaleClosed,
		])
		await ethers.provider.send("evm_mine", [])

		expect(await presaleERC20.getClaimableAmount(user2.address)).to.equal(
			0
		)
		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_getClamiableAmount_someAmountPaid_thenSuccess", async () => {
		const snapShot = await ethers.provider.send("evm_snapshot", [])

		await presaleERC20.connect(owner)
		await presaleERC20.setPayRange(10, 10000)
		await presaleERC20.setVestingParameter(vestingDuration, vestingCliff)
		await presaleERC20.setPrice(100000000)

		await presaleERC20.connect(user1).invest(20)

		let blockNumber = await ethers.provider.getBlockNumber()
		let block = await ethers.provider.getBlock(blockNumber)
		const twoYearsAfterCliff =
			24 * 30 * 24 * 3600 + vestingCliff - block.timestamp
		await ethers.provider.send("evm_increaseTime", [twoYearsAfterCliff])
		await ethers.provider.send("evm_mine", [])

		const claimable = await presaleERC20.getClaimableAmount(user1.address)
		blockNumber = await ethers.provider.getBlockNumber()
		block = await ethers.provider.getBlock(blockNumber)

		expect(claimable).to.equal(1000000000)
		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_claim_claimableAmountIsZero_thenReverts", async () => {
		await presaleERC20.connect(owner)
		await presaleERC20.setPayRange(10, 10000)
		await presaleERC20.setVestingParameter(vestingDuration, vestingCliff)

		await presaleERC20.connect(user2).invest(30)

		const snapShot = await ethers.provider.send("evm_snapshot", [])
		const timeUntilPresaleClosed = endTime - Date.now() / 1000
		await ethers.provider.send("evm_increaseTime", [
			timeUntilPresaleClosed,
		])
		await ethers.provider.send("evm_mine", [])

		await expect(presaleERC20.connect(user2).claim()).to.be.revertedWith(
			"claimable amount is zero."
		)
		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_claim_afterPresaleClosed_thenSuccess", async () => {
		const snapShot = await ethers.provider.send("evm_snapshot", [])

		await presaleERC20.connect(owner)
		await presaleERC20.setPayRange(10, 10000)
		await presaleERC20.setVestingParameter(vestingDuration, vestingCliff)
		await presaleERC20.setPrice(100000000)

		await presaleERC20.connect(user1).invest(20)

		const blockNumber = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNumber)

		const twoYearsAfterCliff =
			24 * 30 * 24 * 3600 + vestingCliff - block.timestamp
		await ethers.provider.send("evm_increaseTime", [twoYearsAfterCliff])
		await ethers.provider.send("evm_mine", [])

		await presaleERC20.connect(user1).claim()
		const balance = await buyToken.balanceOf(user1.address)
		assert.approximately(balance.toNumber(), 1000000000, 100)

		await ethers.provider.send("evm_increaseTime", [24 * 30 * 24 * 3600])
		await ethers.provider.send("evm_mine", [])

		await presaleERC20.connect(user1).claim()

		await expect(await presaleERC20.balanceOfBuy(user1.address)).to.equal(
			0
		)
		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_withdrawPayToken_asOwner_afterClosed_zeroPaidAmount_thenSuccess", async () => {
		const snapShot = await ethers.provider.send("evm_snapshot", [])

		await presaleERC20.connect(owner)
		await presaleERC20.setPayRange(10, 10000)
		await presaleERC20.setVestingParameter(vestingDuration, vestingCliff)
		await presaleERC20.setPrice(100000000)

		const blockNumber = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNumber)

		const twoYearsAfterCliff =
			24 * 30 * 24 * 3600 + vestingCliff - block.timestamp
		await ethers.provider.send("evm_increaseTime", [twoYearsAfterCliff])
		await ethers.provider.send("evm_mine", [])

		await expect(presaleERC20.withdrawPayToken()).to.be.revertedWith(
			"withdraw paytoken amount is zero."
		)

		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_withdrawPayToken_asOwner_afterClosed_somePaidAmount_thenSuccess", async () => {
		const snapShot = await ethers.provider.send("evm_snapshot", [])
		const prevBalance = await payToken.balanceOf(owner.address)

		await presaleERC20.connect(owner)
		await presaleERC20.setPayRange(10, 10000)
		await presaleERC20.setVestingParameter(vestingDuration, vestingCliff)
		await presaleERC20.setPrice(100000000)

		await presaleERC20.connect(user1).invest(20)

		const blockNumber = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNumber)

		const twoYearsAfterCliff =
			24 * 30 * 24 * 3600 + vestingCliff - block.timestamp
		await ethers.provider.send("evm_increaseTime", [twoYearsAfterCliff])
		await ethers.provider.send("evm_mine", [])

		await presaleERC20.withdrawPayToken()
		await expect(await payToken.balanceOf(owner.address)).to.equal(
			prevBalance.add(20)
		)

		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_withdrawBuyToken_asOwner_afterClosed_thenSuccess", async () => {
		const snapShot = await ethers.provider.send("evm_snapshot", [])
		const prevBalance = await buyToken.balanceOf(owner.address)

		await presaleERC20.connect(owner)
		await presaleERC20.setPayRange(10, 10000)
		await presaleERC20.setVestingParameter(vestingDuration, vestingCliff)
		await presaleERC20.setPrice(100000000)

		await presaleERC20.connect(user1).invest(20)

		const blockNumber = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNumber)

		const twoYearsAfterCliff =
			24 * 30 * 24 * 3600 + vestingCliff - block.timestamp
		await ethers.provider.send("evm_increaseTime", [twoYearsAfterCliff])
		await ethers.provider.send("evm_mine", [])

		await presaleERC20.withdrawBuyToken()
		await expect(
			(await buyToken.balanceOf(presaleERC20.address)).toNumber()
		).to.equal(2000000000)
		await expect(await buyToken.balanceOf(owner.address)).to.equal(
			prevBalance.add(41750000000)
		)

		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_deposit_asOwner_givenZeroAmount_thenReverts", async () => {
		await expect(presaleERC20.deposit(0)).to.be.revertedWith(
			"deposit amount is zero."
		)
	})

	it("test_deposit_asOwner_givenNonZeroAmount_thenSuccess", async () => {
		const prevBalance = await buyToken.balanceOf(owner.address)
		await presaleERC20.deposit(3000)
		await expect(await buyToken.balanceOf(owner.address)).to.equal(
			prevBalance.sub(3000)
		)
		await expect(
			(await buyToken.balanceOf(presaleERC20.address)).toNumber()
		).to.equal(43750003000)
	})
})
