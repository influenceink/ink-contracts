import { expect } from "chai"
import { MockProvider } from "ethereum-waffle"
import { ethers } from "hardhat"
import { Contract, BigNumber } from "ethers"

describe("Vesting", async function () {
	let erc20: Contract
	let cliff: number
	let vesting: Contract
	let snapShot: any

	beforeEach(async () => {
		const [contractOwner] = await ethers.getSigners()
		cliff = Math.floor(Date.now() / 1000) + 60

		erc20 = await (
			await ethers.getContractFactory("BasicToken", contractOwner)
		).deploy(1000)
		await erc20.deployed()

		vesting = await (
			await ethers.getContractFactory("Vesting", contractOwner)
		).deploy(erc20.address, 500, cliff)
		await vesting.deployed()

		await erc20.functions.transfer(vesting.address, 500)
	})

	it("test_initialization", async function () {
		expect(await vesting.startTime()).to.equal(cliff)
		expect(
			(await erc20.functions.balanceOf(vesting.address)).toString()
		).to.equal("500")
	})

	describe("test_for_addBeneficiary", () => {
		it("test_addBeneficiary_asUser_thenReverts", async function () {
			const [, beneficiary] = await ethers.getSigners()

			await expect(
				vesting
					.connect(beneficiary)
					.addBeneficiary(beneficiary.address, 60, 500)
			).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("test_addBeneficiary_asOwner_thenSuccess", async function () {
			const [, beneficiary] = await ethers.getSigners()

			await expect(
				await vesting.addBeneficiary(beneficiary.address, 60, 500)
			)
		})

		it("test_addBeneficiary_asOwner_addOneAdded_thenReverts", async function () {
			const [, beneficiary] = await ethers.getSigners()

			await expect(
				await vesting.addBeneficiary(beneficiary.address, 60, 500)
			)
				.to.emit(vesting, "NewBeneficiaryAdded")
				.withArgs(beneficiary.address, 60, 500)
			await expect(
				vesting.addBeneficiary(beneficiary.address, 60, 500)
			).to.be.revertedWith("Vesting: already exists")
		})
	})

	it("test_beneficiaries", async function () {
		const [, beneficiary] = await ethers.getSigners()
		await vesting.addBeneficiary(beneficiary.address, 60, 500)

		const result = await vesting.beneficiaries(beneficiary.address)
		await expect(result.duration).to.equal(60)
		await expect(result.totalAmount).to.equal(500)
		await expect(result.claimed).to.equal(0)
	})

	describe("test_for_unlockedAmount", () => {
		it("test_unlockedAmount_beforeCliff_returnedZero", async function () {
			const [, beneficiary] = await ethers.getSigners()
			await vesting.addBeneficiary(beneficiary.address, 60, 500)

			await expect(
				await vesting.unlockedAmount(beneficiary.address)
			).to.equal(0)

			let snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_increaseTime", [10])
			await ethers.provider.send("evm_mine", [])

			await expect(
				await vesting.unlockedAmount(beneficiary.address)
			).to.equal(0)

			await ethers.provider.send("evm_revert", [snapShot])
		})

		it("test_unlockedAmount_afterCliff_to_be_greaterThanZero", async function () {
			const [, beneficiary] = await ethers.getSigners()
			await vesting.addBeneficiary(beneficiary.address, 60, 500)

			let snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 30])
			await ethers.provider.send("evm_mine", [])

			await expect(
				await vesting.unlockedAmount(beneficiary.address)
			).to.equal(250)

			await ethers.provider.send("evm_revert", [snapShot])
		})

		it("test_unlockedAmount_after_theEndOfVesting_to_be_totalAmount", async function () {
			const [, beneficiary] = await ethers.getSigners()
			await vesting.addBeneficiary(beneficiary.address, 60, 500)

			let snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 70])
			await ethers.provider.send("evm_mine", [])

			await expect(
				await vesting.unlockedAmount(beneficiary.address)
			).to.equal(500)

			await ethers.provider.send("evm_revert", [snapShot])
		})
	})

	describe("test_claim", () => {
		it("test_claim_thenEmit_Claimed", async function () {
			const [, beneficiary] = await ethers.getSigners()
			await vesting.addBeneficiary(beneficiary.address, 60, 500)

			let snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 30])
			await ethers.provider.send("evm_mine", [])

			await expect(await vesting.claim(beneficiary.address))
				.to.emit(vesting, "Claimed")
				.withArgs(beneficiary.address, 258)

			await ethers.provider.send("evm_revert", [snapShot])
			snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 60])
			await ethers.provider.send("evm_mine", [])

			await expect(await vesting.claim(beneficiary.address))
				.to.emit(vesting, "Claimed")
				.withArgs(beneficiary.address, 500)

			await ethers.provider.send("evm_revert", [snapShot])
		})

		it("test_claim_afterClaimedAll_claimAgain_thenReverts", async function () {
			const [, beneficiary] = await ethers.getSigners()
			await vesting.addBeneficiary(beneficiary.address, 60, 500)

			let snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 60])
			await ethers.provider.send("evm_mine", [])

			await expect(await vesting.claim(beneficiary.address))
				.to.emit(vesting, "Claimed")
				.withArgs(beneficiary.address, 500)

			await expect(vesting.claim(beneficiary.address)).to.be.revertedWith(
				"Vesting: already claimed all"
			)

			await ethers.provider.send("evm_revert", [snapShot])
		})
	})

	describe("test_for_pause", () => {
		it("test_pause_asUser_thenReverts", async function () {
			const [, beneficiary] = await ethers.getSigners()
			await expect(
				vesting.connect(beneficiary).pause()
			).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("test_pause_asOwner_claim_thenReverts", async function () {
			const [, beneficiary] = await ethers.getSigners()
			await vesting.addBeneficiary(beneficiary.address, 60, 500)

			const snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 30])
			await ethers.provider.send("evm_mine", [])

			await vesting.pause()

			await expect(vesting.claim(beneficiary.address)).to.be.revertedWith(
				"Vesting is paused."
			)

			await ethers.provider.send("evm_revert", [snapShot])
		})

		it("test_resume_asOwner_thenClaimed", async function () {
			const [, beneficiary] = await ethers.getSigners()
			await vesting.addBeneficiary(beneficiary.address, 60, 500)

			const snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 30])
			await ethers.provider.send("evm_mine", [])

			await vesting.pause()

			await expect(vesting.claim(beneficiary.address)).to.be.revertedWith(
				"Vesting is paused."
			)

			await vesting.resume()

			await expect(await vesting.claim(beneficiary.address)).to.emit(
				vesting,
				"Claimed"
			)

			await ethers.provider.send("evm_revert", [snapShot])
		})
	})

	describe("test_for_claimable", () => {
		it("test_claimableAmount_beforeStart_return_zero", async function () {
			const [, beneficiary] = await ethers.getSigners()
			await vesting.addBeneficiary(beneficiary.address, 60, 500)

			await expect(
				await vesting.claimableAmount(beneficiary.address)
			).to.equal(0)
		})

		it("test_claimable_afterStart_return_nonzero", async function () {
			const [, beneficiary] = await ethers.getSigners()
			await vesting.addBeneficiary(beneficiary.address, 60, 500)

			const snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 30])
			await ethers.provider.send("evm_mine", [])

			await expect(
				Number(await vesting.claimableAmount(beneficiary.address))
			).to.greaterThan(0)

			await ethers.provider.send("evm_revert", [snapShot])
		})

		it("test_claimable_after_justClaim_return_zero", async function () {
			const [, beneficiary] = await ethers.getSigners()
			await vesting.addBeneficiary(beneficiary.address, 60, 500)

			const snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 30])
			await ethers.provider.send("evm_mine", [])

			await vesting.claim(beneficiary.address)

			await expect(
				Number(await vesting.claimableAmount(beneficiary.address))
			).to.equal(0)

			await ethers.provider.send("evm_revert", [snapShot])
		})
	})

	it("test_for_onlyMembers", async function () {
		const [, , other] = await ethers.getSigners()
		await expect(vesting.claim(other.address)).to.be.revertedWith(
			"Vesting: not member"
		)
		await expect(vesting.unlockedAmount(other.address)).to.be.revertedWith(
			"Vesting: not member"
		)
		await expect(
			vesting.claimableAmount(other.address)
		).to.be.revertedWith("Vesting: not member")
	})
})
