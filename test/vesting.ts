import { expect } from "chai"
import { ethers } from "hardhat"
import { Contract, BigNumber } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Vesting } from "../typechain-types/Vesting"

describe("Vesting", async function () {
	let erc20: Contract
	let cliff: number
	let vesting: Vesting
	let contractOwner: SignerWithAddress
	let beneficiary: SignerWithAddress
	let beneficiaries: Vesting.BeneficiaryStruct[]

	beforeEach(async () => {
		;[contractOwner, beneficiary] = await ethers.getSigners()
		cliff =
			(
				await ethers.provider.getBlock(
					await ethers.provider.getBlockNumber()
				)
			).timestamp + 60

		erc20 = await (
			await ethers.getContractFactory("INK", contractOwner)
		).deploy()
		await erc20.deployed()

		vesting = (await (
			await ethers.getContractFactory("Vesting", contractOwner)
		).deploy(erc20.address, cliff)) as Vesting
		await vesting.deployed()

		await erc20.functions.transfer(vesting.address, 500)

		beneficiaries = [
			{
				wallet: beneficiary.address,
				duration: BigNumber.from(60),
				amount: BigNumber.from(500),
				claimed: BigNumber.from(0),
				description: "team",
			},
		]
	})

	it("test_setup", async function () {
		expect(await vesting.startTime()).to.equal(cliff)
		expect(
			(await erc20.functions.balanceOf(vesting.address)).toString()
		).to.equal("500")
		expect(await vesting.totalAmount()).to.equal(0)
	})

	describe("test_addBeneficiary", () => {
		it("test_addBeneficiary_asUser_thenReverts", async function () {
			await expect(
				vesting.connect(beneficiary).addBeneficiary([
					{
						wallet: beneficiary.address,
						duration: 60,
						amount: 500,
						claimed: 0,
						description: "team",
					},
				])
			).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("test_addBeneficiary_asOwner_thenSuccess", async function () {
			await vesting.addBeneficiary(beneficiaries)
			await expect((await vesting.wallets()).length).to.equal(1)
			await expect((await vesting.wallets())[0]).to.equal(
				beneficiary.address
			)
		})

		it("test_addBeneficiary_asOwner_add_otherBeneficiary_forWallet_thenReverts", async function () {
			const _beneficiaries: Vesting.BeneficiaryStruct[] = [
				...beneficiaries,
				{
					wallet: beneficiary.address,
					duration: BigNumber.from(120),
					amount: BigNumber.from(500),
					claimed: BigNumber.from(0),
					description: "family",
				},
			]
			await vesting.addBeneficiary(_beneficiaries)
			await expect((await vesting.wallets()).length).to.equal(1)
			await expect(
				(
					await vesting.beneficiariesByWallet(beneficiary.address)
				).length
			).to.equal(2)
		})
	})

	it("test_beneficiariesByWallet", async function () {
		const _beneficiaries: Vesting.BeneficiaryStruct[] = [
			...beneficiaries,
			{
				wallet: beneficiary.address,
				duration: BigNumber.from(120),
				amount: BigNumber.from(500),
				claimed: BigNumber.from(0),
				description: "family",
			},
		]
		await vesting.addBeneficiary(_beneficiaries)
		const returnedBeneficiaries = await vesting.beneficiariesByWallet(
			beneficiary.address
		)
		await expect(returnedBeneficiaries.length).to.equal(2)
		await expect(returnedBeneficiaries[0].duration).to.equal(
			beneficiaries[0].duration
		)
		await expect(returnedBeneficiaries[0].amount).to.equal(
			beneficiaries[0].amount
		)
		await expect(returnedBeneficiaries[0].description).to.equal(
			beneficiaries[0].description
		)
		await expect(returnedBeneficiaries[1].description).to.equal(
			_beneficiaries[1].description
		)
	})

	describe("test_unlockedAmount", () => {
		it("test_unlockedAmount_beforeCliff_thenReturnsZero", async function () {
			await vesting.addBeneficiary(beneficiaries)
			await expect(
				(
					await vesting.unlockedAmount(beneficiary.address)
				)[0]
			).to.equal(BigNumber.from(0))
			let snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_increaseTime", [10])
			await ethers.provider.send("evm_mine", [])
			await expect(
				(
					await vesting.unlockedAmount(beneficiary.address)
				)[0]
			).to.equal(BigNumber.from(0))
			await ethers.provider.send("evm_revert", [snapShot])
		})

		it("test_unlockedAmount_afterCliff_thenReturnsNonzero", async function () {
			await vesting.addBeneficiary(beneficiaries)
			let snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 30])
			await ethers.provider.send("evm_mine", [])
			await expect(
				(
					await vesting.unlockedAmount(beneficiary.address)
				)[0]
			).to.equal(250)
			await ethers.provider.send("evm_revert", [snapShot])
		})

		it("test_unlockedAmount_afterFinished_thenReturnsTotalAmount", async function () {
			await vesting.addBeneficiary(beneficiaries)
			let snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 70])
			await ethers.provider.send("evm_mine", [])
			await expect(
				(
					await vesting.unlockedAmount(beneficiary.address)
				)[0]
			).to.equal(500)
			await ethers.provider.send("evm_revert", [snapShot])
		})
	})

	describe("test_claim", () => {
		it("test_claim_asNotBeneficiary_thenReverts", async function () {
			await expect(vesting.claim(beneficiary.address)).to.be.revertedWith(
				"Vesting: not beneficiary"
			)
		})

		it("test_claim_thenEmit_Claimed", async function () {
			await vesting.addBeneficiary(beneficiaries)
			let snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 30])
			await ethers.provider.send("evm_mine", [])
			await expect(await vesting.claim(beneficiary.address)).to.emit(
				vesting,
				"Claimed"
			)
			await expect(await erc20.balanceOf(beneficiary.address)).to.equal(
				258
			)
			await ethers.provider.send("evm_revert", [snapShot])
			snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 60])
			await ethers.provider.send("evm_mine", [])
			await expect(await vesting.claim(beneficiary.address)).to.emit(
				vesting,
				"Claimed"
			)
			await expect(await erc20.balanceOf(beneficiary.address)).to.equal(
				500
			)
			await ethers.provider.send("evm_revert", [snapShot])
		})
	})

	describe("test_pause", () => {
		it("test_pause_asUser_thenReverts", async function () {
			await expect(
				vesting.connect(beneficiary).pause()
			).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("test_pause_asOwner_callClaim_thenReverts", async function () {
			await vesting.addBeneficiary(beneficiaries)
			const snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 30])
			await ethers.provider.send("evm_mine", [])
			await vesting.pause()
			await expect(await vesting.paused()).to.equal(true)
			await expect(vesting.claim(beneficiary.address)).to.be.revertedWith(
				"Vesting: paused"
			)
			await ethers.provider.send("evm_revert", [snapShot])
		})

		it("test_resume_asOwner_thenClaimed", async function () {
			await vesting.addBeneficiary(beneficiaries)
			const snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 30])
			await ethers.provider.send("evm_mine", [])
			await vesting.pause()
			await expect(await vesting.paused()).to.equal(true)
			await expect(vesting.claim(beneficiary.address)).to.be.revertedWith(
				"Vesting: paused"
			)
			await vesting.resume()
			await expect(await vesting.paused()).to.equal(false)
			await expect(await vesting.claim(beneficiary.address)).to.emit(
				vesting,
				"Claimed"
			)
			await ethers.provider.send("evm_revert", [snapShot])
		})
	})

	describe("test_claimable", () => {
		it("test_claimableAmount_beforeStart_thenReturnsZero", async function () {
			vesting.addBeneficiary(beneficiaries)

			await expect(
				(
					await vesting.claimableAmount(beneficiary.address)
				).length
			).to.equal(1)
			await expect(
				(
					await vesting.claimableAmount(beneficiary.address)
				)[0]
			).to.equal(0)
		})

		it("test_claimable_afterStart_thenReturnsNonZero", async function () {
			await vesting.addBeneficiary(beneficiaries)

			const snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 30])
			await ethers.provider.send("evm_mine", [])

			await expect(
				Number((await vesting.claimableAmount(beneficiary.address))[0])
			).to.greaterThan(0)

			await ethers.provider.send("evm_revert", [snapShot])
		})

		it("test_claimable_after_justClaimed_thenReturnsZero", async function () {
			await vesting.addBeneficiary(beneficiaries)

			const snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [cliff + 30])
			await ethers.provider.send("evm_mine", [])

			await vesting.claim(beneficiary.address)
			await expect(
				Number((await vesting.claimableAmount(beneficiary.address))[0])
			).to.equal(0)

			await ethers.provider.send("evm_revert", [snapShot])
		})
	})

	it("test_onlyBeneficiaries_givenNotBeneficiary_thenReverts", async function () {
		const [, , other] = await ethers.getSigners()
		await expect(vesting.claim(other.address)).to.be.revertedWith(
			"Vesting: not beneficiary"
		)
		await expect(vesting.unlockedAmount(other.address)).to.be.revertedWith(
			"Vesting: not beneficiary"
		)
		await expect(
			vesting.claimableAmount(other.address)
		).to.be.revertedWith("Vesting: not beneficiary")
	})
})
