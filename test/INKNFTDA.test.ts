import { expect } from "chai"
import { ethers } from "hardhat"
import { Contract, BigNumber } from "ethers"
import { INKNFTDA } from "../typechain-types/INKNFTDA"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { MerkleTree } from "merkletreejs"

describe("INKNFT_DutchAuction", () => {
	let startTime: number
	let duration: number
	let totalAmount: number
	let tokensReservedForOwner: number
	let limitPerWallet: number
	let limitPerTx: number
	let startingPrice: number
	let finalPrice: number
	let payToken: Contract
	let inknftDA: INKNFTDA
	let signers: SignerWithAddress[] = []
	let merkleLeaves: string[] = []
	let merkleRoot: string
	let baseURI: string = "https://influenceink-da/"
	let merkleTree: MerkleTree

	before(async () => {
		signers = await ethers.getSigners()
		startTime =
			(
				await ethers.provider.getBlock(
					await ethers.provider.getBlockNumber()
				)
			).timestamp + 3600
		duration = 3600
		totalAmount = 5
		tokensReservedForOwner = 1
		limitPerWallet = 3
		limitPerTx = 2
		startingPrice = 100
		finalPrice = 50
		payToken = await (
			await ethers.getContractFactory("INK", signers[0])
		).deploy()
		await payToken.deployed()

		for (let i = 0; i < 9; i++)
			merkleLeaves.push(ethers.utils.keccak256(signers[i + 2].address))
		merkleTree = new MerkleTree(merkleLeaves, ethers.utils.keccak256, {
			sortPairs: true,
		})
		merkleRoot = merkleTree.getHexRoot()

		inknftDA = (await (
			await ethers.getContractFactory("INKNFTDA", signers[1])
		).deploy(
			startTime,
			duration,
			totalAmount,
			tokensReservedForOwner,
			limitPerWallet,
			limitPerTx,
			startingPrice,
			finalPrice,
			payToken.address
		)) as INKNFTDA
		await inknftDA.deployed()
	})

	it("test_setup", async () => {
		await expect(await inknftDA.startTime()).to.equal(startTime)
		await expect(await inknftDA.duration()).to.equal(duration)
		await expect(await inknftDA.totalAmount()).to.equal(totalAmount)
		await expect(await inknftDA.tokensReservedForOwner()).to.equal(
			tokensReservedForOwner
		)
		await expect(await inknftDA.limitPerWallet()).to.equal(limitPerWallet)
		await expect(await inknftDA.limitPerTx()).to.equal(limitPerTx)
		await expect(await inknftDA.startingPrice()).to.equal(startingPrice)
		await expect(await inknftDA.finalPrice()).to.equal(finalPrice)
		await expect(await inknftDA.payToken()).to.equal(payToken.address)
		await expect(await inknftDA.totalSupplyForDutchAuction()).to.equal(
			totalAmount - tokensReservedForOwner
		)
	})

	it("test_setPeriod_asUser_thenReverts", async () => {
		await expect(
			inknftDA.connect(signers[0]).setPeriod(startTime, duration)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it("test_setPeriod_asOwner_thenSucceds", async () => {
		await inknftDA.setPeriod(startTime, duration)
	})

	it("test_setMerkleRoot_asUser_thenReverts", async () => {
		await expect(
			inknftDA.connect(signers[0]).setMerkleRoot(merkleRoot)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it("test_setMerkleRoot_asOwner_thenSucceds", async () => {
		await inknftDA.setMerkleRoot(merkleRoot)
	})

	it("test_setBaseURI_asUser_thenReverts", async () => {
		await expect(
			inknftDA.connect(signers[0]).setBaseURI(baseURI)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it("test_setBaseURI_asOwner_thenSucceds", async () => {
		await inknftDA.setBaseURI(baseURI)
	})

	it("test_setPayToken_asUser_thenReverts", async () => {
		await expect(
			inknftDA.connect(signers[0]).setPayToken(payToken.address)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it("test_setPayToken_asOwner_thenSucceds", async () => {
		await inknftDA.setPayToken(payToken.address)
	})

	it("test_setMintAmountLimits_asUser_thenReverts", async () => {
		await expect(
			inknftDA
				.connect(signers[0])
				.setMintAmountLimits(limitPerWallet, limitPerTx)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it("test_setMintAmountLimits_asOwner_thenSucceds", async () => {
		await inknftDA.setMintAmountLimits(limitPerWallet, limitPerTx)
	})

	it("test_mintDutchAuction_asNotWhitelistedUser_thenReverts", async () => {
		await expect(
			inknftDA.mintDutchAuction(signers[0].address, 5, [])
		).to.be.revertedWith("INKNFT: not whitelisted")
	})

	it("test_mintDutchAuction_asWhitelistedUser_givenInvalidTime_thenReverts", async () => {
		let proof = merkleTree.getHexProof(merkleLeaves[0])
		await expect(
			inknftDA
				.connect(signers[2])
				.mintDutchAuction(signers[0].address, 5, proof)
		).to.be.revertedWith("INKNFT: sale is not alive")

		const snapShot = await ethers.provider.send("evm_snapshot", [])
		await ethers.provider.send("evm_setNextBlockTimestamp", [
			startTime + duration + 10,
		])
		await ethers.provider.send("evm_mine", [])

		proof = merkleTree.getHexProof(merkleLeaves[0])
		await expect(
			inknftDA
				.connect(signers[2])
				.mintDutchAuction(signers[0].address, 5, proof)
		).to.be.revertedWith("INKNFT: sale is not alive")

		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_mintDutchAuction_asWhitelistedUser_givenInvalidAmount_thenReverts", async () => {
		const snapShot = await ethers.provider.send("evm_snapshot", [])
		await ethers.provider.send("evm_setNextBlockTimestamp", [
			startTime + 10,
		])
		await ethers.provider.send("evm_mine", [])

		const proof = merkleTree.getHexProof(merkleLeaves[0])
		await expect(
			inknftDA
				.connect(signers[2])
				.mintDutchAuction(signers[0].address, 0, proof)
		).to.be.revertedWith("INKNFT: invalid mint amount")

		await expect(
			inknftDA
				.connect(signers[2])
				.mintDutchAuction(signers[0].address, 3, proof)
		).to.be.revertedWith("INKNFT: invalid mint amount")

		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_mintDutchAuction_asWhitelistedUser_givenRightParams_thenSucceeds", async () => {
		const snapShot = await ethers.provider.send("evm_snapshot", [])
		await ethers.provider.send("evm_setNextBlockTimestamp", [
			startTime + 1200,
		])
		await ethers.provider.send("evm_mine", [])

		const proof = merkleTree.getHexProof(merkleLeaves[0])
		await payToken.transfer(signers[2].address, 200)
		await payToken.connect(signers[2]).approve(inknftDA.address, 200)

		await inknftDA
			.connect(signers[2])
			.mintDutchAuction(signers[0].address, 2, proof)

		await expect(await inknftDA.balanceOf(signers[0].address)).to.equal(2)
		await expect(await payToken.balanceOf(inknftDA.address)).to.be.above(
			BigNumber.from(0)
		)

		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_mintDutchAuction_asWhitelistedUser_givenTooManyAmount_thenReverts", async () => {
		const snapShot = await ethers.provider.send("evm_snapshot", [])
		await ethers.provider.send("evm_setNextBlockTimestamp", [
			startTime + 1200,
		])
		await ethers.provider.send("evm_mine", [])

		let proof = merkleTree.getHexProof(merkleLeaves[0])
		await payToken.transfer(signers[2].address, 300)
		await payToken.connect(signers[2]).approve(inknftDA.address, 300)

		await inknftDA
			.connect(signers[2])
			.mintDutchAuction(signers[0].address, 2, proof)

		await expect(
			inknftDA
				.connect(signers[2])
				.mintDutchAuction(signers[0].address, 2, proof)
		).to.be.revertedWith("INKNFT: minting amount exceeds")

		await inknftDA
			.connect(signers[2])
			.mintDutchAuction(signers[0].address, 1, proof)

		proof = merkleTree.getHexProof(merkleLeaves[1])
		await expect(
			inknftDA
				.connect(signers[3])
				.mintDutchAuction(signers[4].address, 2, proof)
		).to.be.revertedWith("INKNFT: minting amount exceeds")

		await ethers.provider.send("evm_revert", [snapShot])
	})

	it("test_ownerMint_asUser_thenReverts", async () => {
		await expect(
			inknftDA.connect(signers[2]).ownerMint(signers[0].address, 2)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it("test_ownerMint_asOwner_givenTooManyAmount_thenReverts", async () => {
		await expect(
			inknftDA.ownerMint(signers[0].address, 3)
		).to.be.revertedWith("INKNFT: invalid mint amount")
	})

	it("test_ownerMint_asOwner_thenSucceeds", async () => {
		await inknftDA.ownerMint(signers[0].address, 1)
	})

	it("test_withdrawTo_asOwner_thenSucceeds", async () => {
		const snapShot = await ethers.provider.send("evm_snapshot", [])
		await ethers.provider.send("evm_setNextBlockTimestamp", [
			startTime + 1200,
		])
		await ethers.provider.send("evm_mine", [])

		let proof = merkleTree.getHexProof(merkleLeaves[0])
		await payToken.transfer(signers[2].address, 200)
		await payToken.connect(signers[2]).approve(inknftDA.address, 200)

		await inknftDA
			.connect(signers[2])
			.mintDutchAuction(signers[0].address, 2, proof)
		await inknftDA.withdrawTo(signers[3].address)
		await expect(await payToken.balanceOf(signers[3].address)).to.equal(
			168
		)

		await ethers.provider.send("evm_revert", [snapShot])
	})
})
