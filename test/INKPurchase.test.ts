import { expect } from "chai"
import { ethers } from "hardhat"
import { Contract, BigNumber } from "ethers"
import { INKPurchase } from "../typechain-types/INKPurchase"
import ERC20 from "@uniswap/v2-core/build/ERC20.json"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

describe("INKPurchase", () => {
	let INKPurchase: INKPurchase
	let swapRouter: Contract
	let usdc: Contract
	let weth: Contract
	let dai: Contract
	let user: SignerWithAddress

	before(async () => {
		const [signer1, signer2, signer3] = await ethers.getSigners()
		;[, , , user] = await ethers.getSigners()

		const erc20Factory = new ethers.ContractFactory(
			ERC20.abi,
			ERC20.bytecode,
			signer1
		)
		usdc = await erc20Factory.deploy("1000000000000000000000000")
		weth = await erc20Factory.deploy("1000000000000000000000000")
		dai = await erc20Factory.deploy("1000000000000000000000000")

		swapRouter = await (
			await ethers.getContractFactory("MockUniswapV3Router", signer3)
		).deploy()

		INKPurchase = await (
			await ethers.getContractFactory("INKPurchase", signer2)
		).deploy(swapRouter.address, usdc.address)

		await usdc.transfer(swapRouter.address, "500000000000000000000000")
		await dai.transfer(swapRouter.address, "500000000000000000000000")

		await usdc.transfer(user.address, "100000000000000000000000")
		await dai.transfer(user.address, "100000000000000000000000")
	})

	it("test_setup", async () => {
		await expect(await INKPurchase.usdc()).to.equal(usdc.address)
	})

	it("test_purchaseForUSDC", async () => {
		await usdc
			.connect(user)
			.approve(INKPurchase.address, "100000000000000000000")
		await expect(
			await INKPurchase.connect(user).purchaseForUSDC(
				"100000000000000000000"
			)
		)
			.to.emit(INKPurchase, "Purchased")
			.withArgs(user.address, "100000000000000000000")
	})

	it("test_purchaseForETH", async () => {
		await expect(
			await INKPurchase.connect(user).purchaseForETH(weth.address, {
				value: "200000000000000000000",
			})
		)
			.to.emit(INKPurchase, "Purchased")
			.withArgs(user.address, "100000000000000000000")
	})

	it("test_purchaseForToken", async () => {
		await dai
			.connect(user)
			.approve(INKPurchase.address, "200000000000000000000")

		await expect(
			await INKPurchase.connect(user).purchaseForToken(
				dai.address,
				"200000000000000000000"
			)
		)
			.to.emit(INKPurchase, "Purchased")
			.withArgs(user.address, "100000000000000000000")
	})

	it("test_withdrawFunds_asUser_thenReverts", async () => {
		await expect(
			INKPurchase.connect(user).withdrawFunds(user.address)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it("test_withdrawFunds_asUser_thenSucceeds", async () => {
		const [, , , , user] = await ethers.getSigners()
		await INKPurchase.withdrawFunds(user.address)
		await expect(await usdc.balanceOf(user.address)).to.equal(
			"300000000000000000000"
		)
	})
})
