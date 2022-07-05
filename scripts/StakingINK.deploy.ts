import { ethers } from "hardhat"
import { output } from "./util"
import stakingINKParams from "./deploymentParams/stakingINK.json"

async function main() {
	const StakingINK = await ethers.getContractFactory("StakingINK")
	const stakingINK = await StakingINK.deploy(stakingINKParams.inkToken)

	await stakingINK.deployed()

	output(process.env.HARDHAT_NETWORK || "", {
		StakingINK: stakingINK.address,
	})
	console.log("StakingINK deployed to:", stakingINK.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
	console.error(error)
	process.exitCode = 1
})
