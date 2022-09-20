// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract INKPurchase is Ownable {
	using SafeERC20 for IERC20;

	address public immutable usdc;
	address public treasuryWallet;
	address public constant weth9 =
		0xc778417E063141139Fce010982780140Aa0cD5Ab;
	ISwapRouter public uniswapRouter;
	mapping(address => uint256) public purchasedAmount;

	event Purchased(address buyer, uint256 amount);

	constructor(address _treasuryWallet, address _usdc) {
		treasuryWallet = _treasuryWallet;
		uniswapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
		usdc = _usdc;
	}

	// External methods

	function purchaseForUSDC(uint256 _amount) external {
		IERC20(usdc).safeTransferFrom(msg.sender, treasuryWallet, _amount);
		_purchase(_amount);
	}

	function purchaseForETH() external payable {
		ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
			.ExactInputSingleParams({
				tokenIn: weth9,
				tokenOut: usdc,
				fee: 3000,
				recipient: treasuryWallet,
				deadline: block.timestamp + 15,
				amountIn: msg.value,
				amountOutMinimum: 0,
				sqrtPriceLimitX96: 0
			});

		uint256 usdcAmount = uniswapRouter.exactInputSingle{
			value: msg.value
		}(params);
		_purchase(usdcAmount);
	}

	function purchaseForToken(address _tokenIn, uint256 _amount) external {
		IERC20(_tokenIn).safeTransferFrom(msg.sender, address(this), _amount);
		IERC20(_tokenIn).safeApprove(address(uniswapRouter), _amount);

		ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
			.ExactInputSingleParams({
				tokenIn: _tokenIn,
				tokenOut: usdc,
				fee: 3000,
				recipient: treasuryWallet,
				deadline: block.timestamp + 15,
				amountIn: _amount,
				amountOutMinimum: 0,
				sqrtPriceLimitX96: 0
			});

		uint256 usdcAmount = uniswapRouter.exactInputSingle(params);
		_purchase(usdcAmount);
	}

	function withdrawFunds(address _to) external onlyOwner {
		require(_to != address(0), "Purchase: recipient is the zero address");
		IERC20(usdc).safeTransfer(_to, IERC20(usdc).balanceOf(address(this)));
	}

	function changeTreasuryWallet(address _treasuryWallet) external onlyOwner{
		treasuryWallet = _treasuryWallet;
	}

	// Internal methods

	function _purchase(uint256 _amount) internal {
		require(_amount >= 5000 * (10 ** 6), "Purchase: amount must be at least 5000");

		purchasedAmount[msg.sender] += _amount;
		emit Purchased(msg.sender, _amount);
	}
}
