import { ethers } from "hardhat"
import { output } from "./util"
import presaleParams from "./deploymentParams/presale.json"

async function main() {
	const Presale = await ethers.getContractFactory("Presale")
	const presale = await Presale.deploy(
		presaleParams.totalAmount,
		presaleParams.maxAmountPerWallet,
		presaleParams.minAmountPerWallet,
		presaleParams.usdc,
		presaleParams.weth,
		presaleParams.routerAddress
	)

	await presale.deployed()

	output(process.env.HARDHAT_NETWORK || "", {
		Presale: presale.address,
	})
	console.log("Presale deployed to:", presale.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
	console.error(error)
	process.exitCode = 1
})
