import { ethers } from "hardhat"
import vestingParams from "./deploymentParams/vesting.json"

async function main() {
	const Vesting = await ethers.getContractFactory("Vesting")
	const vesting = await Vesting.deploy(
		vestingParams.vestingToken,
		vestingParams.startTime
	)

	await vesting.deployed()

	console.log("Vesting deployed to:", vesting.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
	console.error(error)
	process.exitCode = 1
})
