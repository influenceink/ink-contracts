import { ethers } from "hardhat"
import { output } from "./util"
import presaleETHParams from "./deploymentParams/presaleETH.json"

async function main() {
	const PresaleETH = await ethers.getContractFactory("PresaleETH")
	const presaleETH = await PresaleETH.deploy(
		presaleETHParams.inkToken,
		presaleETHParams.startTime,
		presaleETHParams.endTime,
		presaleETHParams.cliff
	)

	await presaleETH.deployed()

	output(process.env.HARDHAT_NETWORK || "", {
		PresaleETH: presaleETH.address,
	})
	console.log("PresaleETH deployed to:", presaleETH.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
	console.error(error)
	process.exitCode = 1
})
