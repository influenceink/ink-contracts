import { expect } from "chai"
import { ethers } from "hardhat"
import { Contract, BigNumber } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Presale } from "../typechain-types/Presale"
import ERC20 from "@uniswap/v2-core/build/ERC20.json"

describe("Presale", () => {
	let presale: Presale
	let swapRouter: Contract
	let usdc: Contract
	let weth: Contract
	let totalAmount: BigNumber = BigNumber.from("100000000000000000000")
	let maxAmountPerWallet: BigNumber = BigNumber.from(
		"10000000000000000000"
	)
	let minAmountPerWallet: BigNumber = BigNumber.from("5000000000000000000")
	let signers: SignerWithAddress[] = []

	before(async () => {
		signers = await ethers.getSigners()

		const deployer = await ethers.provider.getSigner()

		swapRouter = await (
			await ethers.getContractFactory("MockUniswapV3Router", deployer)
		).deploy()

		var erc20Factory = new ethers.ContractFactory(
			ERC20.abi,
			ERC20.bytecode,
			deployer
		)

		usdc = await erc20Factory.deploy("1000000000000000000000000")
		weth = await erc20Factory.deploy("1000000000000000000000000")
		usdc.transfer(swapRouter.address, "500000000000000000000000")

		presale = (await (
			await ethers.getContractFactory("Presale", signers[1])
		).deploy(
			totalAmount,
			maxAmountPerWallet,
			minAmountPerWallet,
			usdc.address,
			weth.address,
			swapRouter.address
		)) as Presale

		await presale.deployed()
	})

	it("test_setup", async () => {
		await expect(await presale.maxAmountPerWallet()).to.equal(
			maxAmountPerWallet
		)
		await expect(await presale.totalAmount()).to.equal(totalAmount)
		await expect(await presale.minAmountPerWallet()).to.equal(
			minAmountPerWallet
		)
	})

	it("test_resume_asUser_thenReverts", async () => {
		await expect(presale.connect(signers[2]).resume()).to.be.revertedWith(
			"Ownable: caller is not the owner"
		)
	})

	it("test_resume_asOwner_thenSucceeds", async () => {
		await presale.resume()
		await expect(await presale.saleStatus()).to.equal(true)
	})

	it("test_investForUSDC_givenLessThanMin_thenReverts", async () => {
		await expect(
			presale.connect(signers[2]).investForUSDC(3)
		).to.be.revertedWith("Presale: invalid amount")
	})

	it("test_investForUSDC_givenMoreThanMax_thenReverts", async () => {
		await expect(
			presale.connect(signers[2]).investForUSDC("11000000000000000000")
		).to.be.revertedWith("Presale: invalid amount")
	})

	it("test_investForUSDC_givenRightParams_thenSucceeds", async () => {
		await usdc.transfer(signers[2].address, "6000000000000000000")
		await usdc
			.connect(signers[2])
			.approve(presale.address, "6000000000000000000")
		await presale.connect(signers[2]).investForUSDC("6000000000000000000")
		await expect(
			await presale.investedAmounts(signers[2].address)
		).to.equal("6000000000000000000")
	})

	it("test_investForETH_givenLessThanMin_thenReverts", async () => {
		await expect(
			presale
				.connect(signers[3])
				.investForETH({ value: "9000000000000000000" })
		).to.be.revertedWith("Presale: invalid amount")
	})

	it("test_investForETH_givenMoreThanMax_thenReverts", async () => {
		await expect(
			presale
				.connect(signers[3])
				.investForETH({ value: "21000000000000000000" })
		).to.be.revertedWith("Presale: invalid amount")
	})

	it("test_investForETH_givenRightParams_thenSucceeds", async () => {
		await presale
			.connect(signers[3])
			.investForETH({ value: "15000000000000000000" })
		await expect(
			await presale.investedAmounts(signers[3].address)
		).to.equal("7500000000000000000")
	})

	it("test_pause_asUser_thenReverts", async () => {
		await expect(presale.connect(signers[2]).pause()).to.be.revertedWith(
			"Ownable: caller is not the owner"
		)
	})

	it("test_pause_resume_asOwner_thenSucceeds", async () => {
		await presale.pause()
		await expect(await presale.saleStatus()).to.equal(false)
	})

	it("test_setTotalAmount_asUser_thenReverts", async () => {
		await expect(
			presale.connect(signers[2]).setTotalAmount(100)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it("test_setTotalAmount_asOwner_thenSucceeds", async () => {
		await presale.setTotalAmount(100)
	})

	it("test_setLimitPerWallet_asUser_thenReverts", async () => {
		await expect(
			presale.connect(signers[2]).setLimitPerWallet(10, 5)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it("test_setLimitPerWallet_asOwner_thenSucceeds", async () => {
		await presale.setLimitPerWallet(10, 5)
	})
})
