import { expect } from "chai"
import { ethers } from "hardhat"
import { Contract } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { MerkleTree } from "merkletreejs"

describe("INKNFT", function () {
	let collection: Contract
	let payToken: Contract
	let mintPrice: number = 50
	let limitPerWallet: number = 4
	let limitPerTx: number = 3
	let startTime: number
	let endTime: number
	let member: SignerWithAddress
	let commonUser: SignerWithAddress
	let signer: SignerWithAddress
	let leaves: string[] = []
	let merkleRoot: string
	let merkleTree: MerkleTree
	const baseURI: string = "https://influenceink/"

	before(async () => {
		;[, member, , , , , , , , commonUser, signer] =
			await ethers.getSigners()

		const signers = await ethers.getSigners()
		for (let i = 1; i < 9; i++) {
			leaves.push(ethers.utils.keccak256(member.address))
		}

		merkleTree = new MerkleTree(leaves, ethers.utils.keccak256)
		merkleRoot = merkleTree.getHexRoot()

		startTime =
			(
				await ethers.provider.getBlock(
					await ethers.provider.getBlockNumber()
				)
			).timestamp + 3600
		endTime = startTime + 3600

		payToken = await (await ethers.getContractFactory("INK")).deploy()
		await payToken.deployed()

		collection = await (
			await ethers.getContractFactory("INKNFT", signer)
		).deploy(
			startTime,
			endTime,
			mintPrice,
			limitPerWallet,
			limitPerTx,
			payToken.address
		)
		await collection.deployed()
	})

	it("test_setup", async function () {
		await expect(await collection.totalSupply()).to.equal(0)
		await expect(await collection.baseURI()).to.equal("")
		await expect(await collection.mintPrice()).to.equal(mintPrice)
		await expect(await collection.payToken()).to.equal(payToken.address)
		await expect(await collection.startTime()).to.equal(startTime)
		await expect(await collection.endTime()).to.equal(endTime)
		await expect(await collection.limitPerWallet()).to.equal(
			limitPerWallet
		)
		await expect(await collection.limitPerTx()).to.equal(limitPerTx)
	})

	describe("test_setBaseURI", () => {
		it("test_setBaseURI_asUser_thenReverts", async () => {
			await expect(
				collection.connect(member).setBaseURI(baseURI)
			).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("test_setBaseURI_asUser_thenSucceeds", async () => {
			await collection.setBaseURI(baseURI)
			await expect(await collection.baseURI()).to.equal(baseURI)
		})
	})

	describe("test_setMerkleRoot", () => {
		it("test_setMerkleRoot_asUser_thenReverts", async () => {
			await expect(
				collection
					.connect(member)
					.setMerkleRoot(
						ethers.utils.hexZeroPad(ethers.utils.hexlify(merkleRoot), 32)
					)
			).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("test_setMerkleRoot_asOwner_thenSucceeds", async () => {
			await collection.setMerkleRoot(
				ethers.utils.hexZeroPad(ethers.utils.hexlify(merkleRoot), 32)
			)
			await expect(BigInt(await collection.merkleRoot())).to.equal(
				merkleRoot.toString()
			)
		})
	})

	describe("test_mint", function () {
		let snapShot: any

		it("test_mint_asNotMember_thenReverts", async function () {
			let proof: string[] = []
			await expect(
				collection
					.connect(commonUser)
					.mint(commonUser.address, 1, leaves[0], proof)
			).to.be.revertedWith("INKNFT: not allowed to call")
			await expect(
				collection
					.connect(commonUser)
					.mint(
						commonUser.address,
						1,
						ethers.utils.keccak256(commonUser.address),
						proof
					)
			).to.be.revertedWith("INKNFT: not whitelisted")
		})

		it("test_mint_asMember_givenSaleNotOpened_thenReverts", async function () {
			let proof = merkleTree.getHexProof(leaves[0])
			await expect(
				collection
					.connect(member)
					.mint(member.address, 0, leaves[0], proof)
			).to.be.revertedWith("INKNFT: sale is not alive")

			snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [
				endTime + 10,
			])
			await ethers.provider.send("evm_mine", [])

			proof = merkleTree.getHexProof(leaves[0])
			await expect(
				collection
					.connect(member)
					.mint(member.address, 3, leaves[0], proof)
			).to.be.revertedWith("INKNFT: sale is not alive")

			await ethers.provider.send("evm_revert", [snapShot])
		})

		it("test_mint_asMember_afterStart_givenInvalidAmount_thenReverts", async function () {
			snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [startTime])
			await ethers.provider.send("evm_mine", [])
			let proof = merkleTree.getHexProof(leaves[0])
			await expect(
				collection
					.connect(member)
					.mint(member.address, 0, leaves[0], proof)
			).to.be.revertedWith("INKNFT: invalid mint amount")

			proof = merkleTree.getHexProof(leaves[0])
			await expect(
				collection
					.connect(member)
					.mint(member.address, limitPerTx + 1, leaves[0], proof)
			).to.be.revertedWith("INKNFT: invalid mint amount")
		})

		it("test_mint_asMember_givenNotApprovedToTransfer_thenReverts", async function () {
			let proof = merkleTree.getHexProof(leaves[0])
			await expect(
				collection
					.connect(member)
					.mint(member.address, 2, leaves[0], proof)
			).to.be.reverted
		})

		it("test_mint_asMember_givenApproval_thenSucceeds", async function () {
			await payToken.transfer(member.address, 150)
			await payToken.connect(member).approve(collection.address, 150)

			let proof = merkleTree.getHexProof(leaves[0])
			await collection
				.connect(member)
				.mint(member.address, 2, leaves[0], proof)
			await expect(await collection.balanceOf(member.address)).to.equal(2)
			await expect(
				await payToken.balanceOf(await collection.address)
			).to.equal(100)
			await expect(await collection.saleBalances(member.address)).to.equal(
				2
			)
			await expect(await collection.ownerOf(1)).to.equal(member.address)
			await expect(await collection.ownerOf(2)).to.equal(member.address)
		})

		it("test_mint_asMember_givenTooManyAmount_thenReverts", async function () {
			let proof = merkleTree.getHexProof(leaves[0])
			await expect(
				collection
					.connect(member)
					.mint(member.address, 3, leaves[0], proof)
			).to.be.revertedWith("INKNFT: minting amount exceeds")

			await ethers.provider.send("evm_revert", [snapShot])
		})
	})

	describe("test_tokenURI", () => {
		it("test_tokenURI_givenNotExists_thenReverts", async function () {
			await expect(collection.tokenURI(1)).to.be.revertedWith(
				"INKNFT: token not exist"
			)
		})

		it("test_tokenURI_givenExists_thenSucceeds", async function () {
			await collection.ownerMint(commonUser.address, 1)
			await expect(await collection.tokenURI(1)).to.equal(
				baseURI + "1.json"
			)
		})
	})

	describe("test_ownerMint", function () {
		it("test_ownerMint_asUser_thenReverts", async () => {
			await expect(
				collection.connect(member).ownerMint(member.address, 2)
			).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("test_ownerMint_asOwner_thenSucceeds", async () => {
			await collection.ownerMint(member.address, 1)
			await expect(await collection.balanceOf(member.address)).to.equal(1)
		})
	})

	describe("test_setPeriod", function () {
		it("test_setPeriod_asUser_thenReverts", async () => {
			await expect(
				collection.connect(member).setPeriod(startTime - 10, endTime + 10)
			).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("test_setPeriod_asMember_thenSucceeds", async () => {
			await collection.setPeriod(startTime - 10, endTime + 10)
			await expect(await collection.startTime()).to.equal(startTime - 10)
			await expect(await collection.endTime()).to.equal(endTime + 10)
		})
	})

	describe("test_setMintPrice", function () {
		it("test_setMintPrice_asUser_thenReverts", async () => {
			await expect(
				collection.connect(member).setMintPrice(60)
			).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("test_setMintPeriod_asMember_thenSucceeds", async () => {
			await collection.setMintPrice(60)
			await expect(await collection.mintPrice()).to.equal(60)
		})
	})

	describe("test_setMintAmountLimits", function () {
		it("test_setMintAmountLimits_asUser_thenReverts", async () => {
			await expect(
				collection.connect(member).setMintAmountLimits(4, 3)
			).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("test_setMintAmountLimits_asMember_thenSucceeds", async () => {
			await collection.setMintAmountLimits(4, 3)
			await expect(await collection.limitPerWallet()).to.equal(4)
			await expect(await collection.limitPerTx()).to.equal(3)
		})
	})

	describe("test_setPayToken", function () {
		it("test_setPayToken_asUser_thenReverts", async () => {
			await expect(
				collection.connect(member).setPayToken(commonUser.address)
			).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("test_setPayToken_asMember_thenSucceeds", async () => {
			await collection.setPayToken(commonUser.address)
			await expect(await collection.payToken()).to.equal(
				commonUser.address
			)
		})
	})

	describe("test_widthdrawTo", () => {
		it("test_withdrawTo", async () => {
			let snapShot = await ethers.provider.send("evm_snapshot", [])
			await ethers.provider.send("evm_setNextBlockTimestamp", [endTime])
			await ethers.provider.send("evm_mine", [])

			await payToken.transfer(collection.address, 100)
			await collection.setPayToken(payToken.address)
			const balance = await payToken.balanceOf(collection.address)
			await collection.withdrawTo(commonUser.address)
			await expect(await payToken.balanceOf(commonUser.address)).to.equal(
				balance
			)
			await expect(await payToken.balanceOf(collection.address)).to.equal(
				0
			)
			await ethers.provider.send("evm_revert", [snapShot])
		})
	})
})
