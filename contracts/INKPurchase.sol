// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract INKPurchase is Ownable {
	using SafeERC20 for IERC20;

	address public immutable usdc;
	address public constant weth9 =
		0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
	ISwapRouter public uniswapRouter;
	mapping(address => uint256) public purchasedAmount;

	event Purchased(address buyer, uint256 amount);

	constructor(address _routerAddress, address _usdc) {
		uniswapRouter = ISwapRouter(_routerAddress);
		usdc = _usdc;
	}

	// External methods

	function purchaseForUSDC(uint256 _amount) external {
		IERC20(usdc).safeTransferFrom(msg.sender, address(this), _amount);
		_purchase(_amount);
	}

	function purchaseForETH() external payable {
		ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
			.ExactInputSingleParams({
				tokenIn: weth9,
				tokenOut: usdc,
				fee: 3000,
				recipient: address(this),
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
		IERC20(_tokenIn).approve(address(uniswapRouter), _amount);

		ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
			.ExactInputSingleParams({
				tokenIn: _tokenIn,
				tokenOut: usdc,
				fee: 3000,
				recipient: address(this),
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

	// Internal methods

	function _purchase(uint256 _amount) internal {
		purchasedAmount[msg.sender] += _amount;
		emit Purchased(msg.sender, _amount);
	}
}
