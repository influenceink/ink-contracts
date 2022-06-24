import { expect } from "chai"
import { MockProvider } from "ethereum-waffle"
import { ethers } from "hardhat"
import { Contract, BigNumber } from "ethers"

describe("Vesting", async function () {
	let erc20: Contract
	let startTimeStamp: number
	let vesting: Contract
	let beneficiary: string

	beforeEach(async () => {
		const [wallet] = new MockProvider().getWallets()
		const [signer] = await ethers.getSigners()
		startTimeStamp = Math.floor(Date.now() / 1000) + 60

		erc20 = await (
			await ethers.getContractFactory("BasicToken", signer)
		).deploy(1000)
		await erc20.deployed()

		vesting = await (
			await ethers.getContractFactory("Vesting", signer)
		).deploy(erc20.address, 500, startTimeStamp)
		await vesting.deployed()

		await erc20.functions.transfer(vesting.address, 500)

		beneficiary = wallet.address
	})

	it("test_initialization", async function () {
		expect(await vesting.startTime()).to.equal(startTimeStamp)
		expect(
			(await erc20.functions.balanceOf(vesting.address)).toString()
		).to.equal("500")
	})

	it("test_addBeneficiary_vestingWallets", async function () {
		const addBeneficiaryTx = await vesting.addBeneficiary(
			beneficiary,
			60,
			500
		)
		await addBeneficiaryTx.wait()

		const result = await vesting.vestingWallets(beneficiary)
		await expect(result.duration).to.equal(60)
		await expect(result.totalAmount).to.equal(500)
		await expect(result.claimed).to.equal(0)
	})

	it("test_vestedAmount", async function () {
		const addBeneficiaryTx = await vesting.addBeneficiary(
			beneficiary,
			60,
			500
		)
		await addBeneficiaryTx.wait()

		await expect(await vesting.vestedAmount(beneficiary)).to.equal(0)

		let snapShot = await ethers.provider.send("evm_snapshot", [])
		await ethers.provider.send("evm_setNextBlockTimestamp", [
			startTimeStamp + 30,
		])
		await ethers.provider.send("evm_mine", [])

		await expect(await vesting.vestedAmount(beneficiary)).to.equal(250)

		await ethers.provider.send("evm_revert", [snapShot])
		snapShot = await ethers.provider.send("evm_snapshot", [])
		await ethers.provider.send("evm_setNextBlockTimestamp", [
			startTimeStamp + 60,
		])
		await ethers.provider.send("evm_mine", [])

		await expect(await vesting.vestedAmount(beneficiary)).to.equal(500)

		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_claim", async function () {
		const addBeneficiaryTx = await vesting.addBeneficiary(
			beneficiary,
			60,
			500
		)
		await addBeneficiaryTx.wait()

		let snapShot = await ethers.provider.send("evm_snapshot", [])
		await ethers.provider.send("evm_setNextBlockTimestamp", [
			startTimeStamp + 30,
		])
		await ethers.provider.send("evm_mine", [])

		await expect(await vesting.claim(beneficiary)).to.emit(
			vesting,
			"INKClaimed"
		)

		await ethers.provider.send("evm_revert", [snapShot])
		snapShot = await ethers.provider.send("evm_snapshot", [])
		await ethers.provider.send("evm_setNextBlockTimestamp", [
			startTimeStamp + 60,
		])
		await ethers.provider.send("evm_mine", [])

		await expect(await vesting.claim(beneficiary))
			.to.emit(vesting, "INKClaimed")
			.withArgs(beneficiary, 500)

		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_pause_resume", async function () {
		const addBeneficiaryTx = await vesting.addBeneficiary(
			beneficiary,
			60,
			500
		)
		await addBeneficiaryTx.wait()

		const snapShot = await ethers.provider.send("evm_snapshot", [])
		await ethers.provider.send("evm_setNextBlockTimestamp", [
			startTimeStamp + 30,
		])
		await ethers.provider.send("evm_mine", [])

		await vesting.pause()

		await expect(vesting.claim(beneficiary)).to.be.revertedWith(
			"Vesting is paused."
		)

		await vesting.resume()

		await expect(await vesting.claim(beneficiary)).to.emit(
			vesting,
			"INKClaimed"
		)

		await ethers.provider.send("evm_revert", [snapShot])
	})
})
