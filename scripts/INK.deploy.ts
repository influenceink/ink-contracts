import { ethers } from "hardhat"
import { output } from "./util"

async function main() {
	const INK = await ethers.getContractFactory("INK")
	const ink = await INK.deploy()

	await ink.deployed()

	output(process.env.HARDHAT_NETWORK || "", { INK: ink.address })
	console.log("INK deployed to:", "ink.address")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
	console.error(error)
	process.exitCode = 1
})
