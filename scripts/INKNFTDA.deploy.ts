import { ethers } from "hardhat"
import { output } from "./util"
import inknftdaParams from "./deploymentParams/inknftda.json"

async function main() {
	const INKNFTDA = await ethers.getContractFactory("INKNFTDA")
	const inknftda = await INKNFTDA.deploy(
		inknftdaParams.startTime,
		inknftdaParams.endTime,
		inknftdaParams.maxSupply,
		inknftdaParams.reservedForOwner,
		inknftdaParams.limitPerWallet,
		inknftdaParams.limitPerTx,
		inknftdaParams.startingPrice,
		inknftdaParams.finalPrice,
		inknftdaParams.payToken
	)

	await inknftda.deployed()

	output(process.env.HARDHAT_NETWORK || "", { INKNFTDA: inknftda.address })
	console.log("INKNFTDA deployed to:", inknftda.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
	console.error(error)
	process.exitCode = 1
})
