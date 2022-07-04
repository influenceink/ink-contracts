import { ethers } from "hardhat"
import { output } from "./util"
import presaleERC20Params from "./deploymentParams/presaleERC20.json"

async function main() {
	const PresaleERC20 = await ethers.getContractFactory("PresaleERC20")
	const presaleERC20 = await PresaleERC20.deploy(
		presaleERC20Params.payToken,
		presaleERC20Params.buyToken,
		presaleERC20Params.startTime,
		presaleERC20Params.endTime,
		presaleERC20Params.cliff
	)

	await presaleERC20.deployed()

	output(process.env.HARDHAT_NETWORK || "", {
		PresaleERC20: presaleERC20.address,
	})
	console.log("PresaleERC20 deployed to:", presaleERC20.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
	console.error(error)
	process.exitCode = 1
})
