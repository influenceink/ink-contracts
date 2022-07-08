// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PresaleERC20 is Ownable, ReentrancyGuard {
	using SafeERC20 for IERC20;

	// the maximum amount of tokens to be sold
	uint256 public MAXGOAL = 437500000000 * 10**18;

	// duration of vesting (4 years)
	uint256 public vestingDuration = 48 * 30 days;

	// how much has been raised by crowdsale (pay token)
	uint256 public amountTotalPaid;

	// how much has been raised by crowdsale (buy token);
	uint256 public amountTotalBought;

	// how much has been claimed by user (buy token)
	uint256 public amountTotalClaimed;

	// the balance of investor's pay token
	mapping(address => uint256) public balanceOfPay;

	// the balance of investor's buy token
	mapping(address => uint256) public balanceOfBuy;

	// the claimed amount of investor's INK
	mapping(address => uint256) public amountClaimed;

	// startTime & endTime date of the crowdsale
	uint256 public startTime;
	uint256 public endTime;

	// vestingCliff time
	uint256 public vestingCliff;

	// token price (1 USDT = 100 INK)
	uint256 public price = 100;

	// the address of pay token contract
	IERC20 public payToken;

	// the address of buy token contract
	IERC20 public buyToken;

	// indicated if the crowdsale has been closed already
	bool public presaleClosed = false;

	// min & max amount of pay token per investor
	uint256 public minPayAmount;
	uint256 public maxPayAmount;

	// notifying transfers and the success of the crowdsale
	event GoalReached(uint256 amountBought);
	event FundsInvested(address addr, uint256 amount);

	modifier afterClosed() {
		require(
			presaleClosed == true || block.timestamp >= endTime,
			"presale is not closed."
		);
		_;
	}

	modifier onlyWhitelisted() {
		//require();
		_;
	}

	// initialization, set the token address, startTime & endTime
	constructor(
		IERC20 _payToken,
		IERC20 _buyToken,
		uint256 _startTime,
		uint256 _endTime,
		uint256 _cliff
	) {
		payToken = _payToken;
		buyToken = _buyToken;
		startTime = _startTime;
		endTime = _endTime;
		vestingCliff = _cliff;
	}

	// set investment range
	function setPayRange(uint256 _min, uint256 _max) external onlyOwner {
		require(_max > _min && _min > 0, "set invalid range.");
		minPayAmount = _min;
		maxPayAmount = _max;
	}

	// set price
	function setPrice(uint256 _price) external onlyOwner {
		require(_price > 0, "price is zero.");
		price = _price;
	}

	// set vesting parameter by admin
	function setVestingParameter(uint256 _vestingDuration, uint256 _cliff)
		external
		onlyOwner
	{
		require(
			presaleClosed == false &&
				block.timestamp < endTime &&
				_cliff > block.timestamp,
			"vesting parameter can't change."
		);
		vestingDuration = _vestingDuration;
		vestingCliff = _cliff;
	}

	// invest pay token by whitelisted user
	function invest(uint256 amountPay) external onlyWhitelisted {
		require(
			presaleClosed == false && block.timestamp < endTime,
			"presale is closed."
		);

		uint256 predictPaidAmount = balanceOfPay[msg.sender] + amountPay;

		require(
			predictPaidAmount >= minPayAmount &&
				predictPaidAmount <= maxPayAmount,
			"fund is out of range."
		);

		balanceOfPay[msg.sender] = predictPaidAmount;
		amountTotalPaid += amountPay;

		payToken.safeTransferFrom(msg.sender, address(this), amountPay);

		uint256 amountBuy = amountPay * price;
		balanceOfBuy[msg.sender] += amountBuy;
		amountTotalBought += amountBuy;

		if (amountTotalBought >= MAXGOAL) {
			presaleClosed = true;
			emit GoalReached(amountTotalBought);
		}

		emit FundsInvested(msg.sender, amountPay);
	}

	// claim available amount of buy token accroding to vesting strategy by whitelisted user
	function claim() external afterClosed onlyWhitelisted nonReentrant {
		uint256 claimableAmount = getClaimableAmount(msg.sender);
		require(claimableAmount > 0, "claimable amount is zero.");
		buyToken.safeTransfer(msg.sender, claimableAmount);
		amountClaimed[msg.sender] += claimableAmount;

		amountTotalClaimed += claimableAmount;
		if (block.timestamp >= vestingCliff + vestingDuration)
			balanceOfBuy[msg.sender] = 0;
	}

	function getClaimableAmount(address _addr)
		public
		view
		returns (uint256)
	{
		return unlockedAmount(_addr) - amountClaimed[_addr];
	}

	function unlockedAmount(address _addr) public view returns (uint256) {
		uint256 balance = balanceOfBuy[_addr];
		uint256 currentTime = block.timestamp;
		if (balance == 0 || currentTime < vestingCliff) return 0;
		uint256 end = vestingCliff + vestingDuration;
		uint256 duration = (currentTime >= end)
			? vestingDuration
			: currentTime - vestingCliff;

		return (balance * duration) / vestingDuration;
	}

	// withdraw raised funds by admin
	function withdrawPayToken() external onlyOwner afterClosed {
		require(amountTotalPaid > 0, "withdraw paytoken amount is zero.");
		payToken.safeTransfer(owner(), amountTotalPaid);
	}

	// withdraw remained buy token by admin
	function withdrawBuyToken() external onlyOwner afterClosed {
		uint256 amount = buyToken.balanceOf(address(this)) +
			amountTotalClaimed -
			amountTotalBought;
		require(amount > 0, "withdraw buytoken amount is zero");
		buyToken.safeTransfer(owner(), amount);
	}

	// deposit buy token to this contract by admin
	function deposit(uint256 amount) external onlyOwner {
		require(amount > 0, "deposit amount is zero.");
		buyToken.safeTransferFrom(msg.sender, address(this), amount);
	}
}
