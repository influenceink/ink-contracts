import { ethers } from "hardhat"
import { output } from "./util"
import inknftParams from "./deploymentParams/inknft.json"

async function main() {
	const INKNFT = await ethers.getContractFactory("INKNFT")
	const inknft = await INKNFT.deploy(
		inknftParams.startTime,
		inknftParams.endTime,
		inknftParams.mintPrice,
		inknftParams.limitPerWallet,
		inknftParams.limitPerTx,
		inknftParams.payToken
	)

	await inknft.deployed()

	output(process.env.HARDHAT_NETWORK || "", { INKNFT: inknft.address })
	console.log("INKNFT deployed to:", inknft.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
	console.error(error)
	process.exitCode = 1
})
