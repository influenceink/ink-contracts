import { ethers } from "hardhat"
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

	console.log("INKNFT deployed to:", inknft.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
	console.error(error)
	process.exitCode = 1
})
