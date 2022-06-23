import { expect } from "chai"
import { MockProvider } from "ethereum-waffle"
import { ethers } from "hardhat"
import { Contract } from "ethers"

describe("Vesting", async function () {
	const cliff: number = 5
	let erc20: Contract
	let startTimeStamp: number
	let vesting: Contract
	let beneficiary: string

	beforeEach(async () => {
		const [wallet] = new MockProvider().getWallets()
		const [signer] = await ethers.getSigners()

		const ERC20 = await ethers.getContractFactory("BasicToken", signer)
		erc20 = await ERC20.deploy(1000)
		await erc20.deployed()

		startTimeStamp = Math.floor(Date.now() / 1000)
		const Vesting = await ethers.getContractFactory("Vesting", signer)
		vesting = await Vesting.deploy(
			erc20.address,
			500,
			startTimeStamp,
			cliff
		)
		await vesting.deployed()

		await erc20.functions.transfer(vesting.address, 500)

		beneficiary = wallet.address
	})

	it("Should return the start time", async function () {
		expect(await vesting.start()).to.equal(startTimeStamp)
	})

	it("Should return the duration", async function () {
		const addVestingWalletTx = await vesting.addVestingWallet(
			beneficiary,
			20,
			50
		)
		await addVestingWalletTx.wait()

		const claimed = await vesting.claimed(beneficiary)
		console.log("\tClaimed amount: ", claimed.toString())
		expect(claimed).to.equal(0)
	})

	it("Should return zero as claimed amount", async function () {
		const addVestingWalletTx = await vesting.addVestingWallet(
			beneficiary,
			20,
			50
		)
		await addVestingWalletTx.wait()

		const claimed = await vesting.claimed(beneficiary)
		console.log("\tClaimed amount: ", claimed.toString())
		expect(claimed).to.equal(0)
	})

	it("Should return total allocation", async function () {
		const addVestingWalletTx = await vesting.addVestingWallet(
			beneficiary,
			7,
			50
		)
		await addVestingWalletTx.wait()

		const claimTx = await vesting.claim(beneficiary)
		await claimTx.wait()

		const vestedAmount = await vesting.vestedAmount(beneficiary)
		const claimed = await vesting.claimed(beneficiary)
		const balance = await erc20.functions.balanceOf(beneficiary)
		console.log("\tClaimed amount: ", claimed.toString())
		console.log("\tVested amount: ", vestedAmount.toString())
		console.log("\tBalance of beneficiary: ", balance.toString())
		expect(claimed).to.equal(50)
	})

	it("Should return greater than zero", async function () {
		const addVestingWalletTx = await vesting.addVestingWallet(
			beneficiary,
			20,
			50
		)
		await addVestingWalletTx.wait()

		let claimTx = await vesting.claim(beneficiary)
		await claimTx.wait()

		let vestedAmount = await vesting.vestedAmount(beneficiary)
		let claimed = await vesting.claimed(beneficiary)
		let balance = await erc20.functions.balanceOf(beneficiary)
		console.log("\tClaimed amount: ", claimed.toString())
		console.log("\tVested amount: ", vestedAmount.toString())
		console.log("\tBalance of beneficiary: ", balance.toString())

		await new Promise((res, rej) => {
			setTimeout(() => res(true), 5000)
		})

		claimTx = await vesting.claim(beneficiary)
		await claimTx.wait()

		vestedAmount = await vesting.vestedAmount(beneficiary)
		claimed = await vesting.claimed(beneficiary)
		balance = await erc20.functions.balanceOf(beneficiary)
		console.log("\tClaimed amount: ", claimed.toString())
		console.log("\tVested amount: ", vestedAmount.toString())
		console.log("\tBalance of beneficiary: ", balance.toString())

		expect(claimed).to.above(0)
	})
})
