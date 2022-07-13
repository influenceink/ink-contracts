// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract Presale is Ownable {
	using SafeERC20 for IERC20;

	ISwapRouter private uniswapRouter;

	uint256 public maxAmountPerWallet;
	uint256 public minAmountPerWallet;
	uint256 public totalAmount;
	uint256 public totalInvestedAmount;

	bool public saleStatus;
	address public immutable usdc;
	address public immutable weth;

	mapping(address => uint256) public investedAmounts;

	event Invested(address investor, uint256 amount);

	constructor(
		uint256 _totalAmount,
		uint256 _maxAmountPerWallet,
		uint256 _minAmountPerWallet,
		address _usdc,
		address _weth,
		address _routerAddress
	) {
		maxAmountPerWallet = _maxAmountPerWallet;
		minAmountPerWallet = _minAmountPerWallet;
		totalAmount = _totalAmount;
		usdc = _usdc;
		uniswapRouter = ISwapRouter(_routerAddress);
		weth = _weth;
	}

	function setTotalAmount(uint256 _totalAmount) external onlyOwner {
		totalAmount = _totalAmount;
	}

	function setLimitPerWallet(
		uint256 _maxAmountPerWallet,
		uint256 _minAmountPerWallet
	) external onlyOwner {
		maxAmountPerWallet = _maxAmountPerWallet;
		minAmountPerWallet = _minAmountPerWallet;
	}

	function resume() external onlyOwner {
		saleStatus = true;
	}

	function pause() external onlyOwner {
		saleStatus = false;
	}

	function investForUSDC(uint256 _amount) external {
		assert(_investable(_amount) == true);
		IERC20(usdc).safeTransferFrom(msg.sender, address(this), _amount);
		_invest(_amount);
	}

	function investForETH() external payable {
		ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
			.ExactInputSingleParams({
				tokenIn: weth,
				tokenOut: usdc,
				fee: 3000,
				recipient: msg.sender,
				deadline: block.timestamp + 15,
				amountIn: msg.value,
				amountOutMinimum: 0,
				sqrtPriceLimitX96: 0
			});

		uint256 usdcAmount = uniswapRouter.exactInputSingle{
			value: msg.value
		}(params);
		assert(_investable(usdcAmount));
		_invest(usdcAmount);
	}

	function _invest(uint256 _amount) internal {
		investedAmounts[msg.sender] += _amount;
		totalInvestedAmount += _amount;
		emit Invested(msg.sender, _amount);
	}

	function _investable(uint256 _amount) private view returns (bool) {
		require(saleStatus == true, "Presale: sale is not alive");
		require(
			_amount + totalInvestedAmount <= totalAmount,
			"Presale: amount exceeds"
		);
		require(
			investedAmounts[msg.sender] + _amount <= maxAmountPerWallet &&
				investedAmounts[msg.sender] + _amount >= minAmountPerWallet,
			"Presale: invalid amount"
		);
		return true;
	}
}
