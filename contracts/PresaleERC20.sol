// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract PresaleERC20 is Ownable {
	using SafeMath for uint256;

	// the maximum amount of tokens to be sold
	uint256 public MAXGOAL = 437500000000 * 10**18;

	// duration of vesting
	uint256 public vestingPeriod = 48 * 30 days;

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

	// start & deadline date of the crowdsale
	uint256 public start;
	uint256 public deadline;
	uint256 public lastClaimed;

	// cliff duration
	uint256 public cliff;

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
	event GoalReached(address beneficiary, uint256 amountBought);
	event FundsTransfer(
		address backer,
		uint256 amount,
		bool isContribution,
		uint256 amountPaid
	);

	modifier afterClosed() {
		require(
			presaleClosed == true || block.timestamp >= deadline,
			"presale is not closed."
		);
		_;
	}

	modifier onlyWhitelisted() {
		//require();
		_;
	}

	// initialization, set the token address, start & deadline
	constructor(
		IERC20 _payToken,
		IERC20 _buyToken,
		uint256 _start,
		uint256 _deadline
	) {
		payToken = _payToken;
		buyToken = _buyToken;
		start = _start;
		deadline = _deadline;
		cliff = _deadline;
		lastClaimed = _deadline;
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
	function setVestingParameter(uint256 _vestingPeriod, uint256 _cliff)
		external
		onlyOwner
	{
		require(
			presaleClosed == false && block.timestamp < deadline,
			"vesting parameter can't change."
		);
		vestingPeriod = _vestingPeriod;
		cliff = _cliff;
		lastClaimed = _cliff;
	}

	// invest pay token by whitelisted user
	function invest(uint256 amountPay) external onlyWhitelisted {
		require(
			presaleClosed == false && block.timestamp < deadline,
			"presale is closed."
		);

		uint256 predictPaidAmount = balanceOfPay[msg.sender].add(amountPay);

		require(
			predictPaidAmount >= minPayAmount,
			"fund is less than minimum amount."
		);

		require(
			predictPaidAmount <= maxPayAmount,
			"fund is more than maximum amount."
		);

		balanceOfPay[msg.sender] = predictPaidAmount;
		amountTotalPaid = amountTotalPaid.add(amountPay);

		payToken.transferFrom(msg.sender, address(this), amountPay);

		uint256 amountBuy = amountPay.mul(price);
		balanceOfBuy[msg.sender] = balanceOfBuy[msg.sender].add(amountBuy);
		amountTotalBought = amountTotalBought.add(amountBuy);

		if (amountTotalBought >= MAXGOAL) {
			presaleClosed = true;
			emit GoalReached(msg.sender, amountTotalBought);
		}

		emit FundsTransfer(msg.sender, amountPay, true, amountTotalPaid);
	}

	// claim available amount of buy token accroding to vesting strategy by whitelisted user
	function claim() external afterClosed onlyWhitelisted {
		uint256 claimableAmount = getClaimableAmount();
		buyToken.transfer(msg.sender, claimableAmount);
		amountTotalClaimed.add(claimableAmount);
		lastClaimed = block.timestamp;
		if (block.timestamp >= cliff.add(vestingPeriod))
			balanceOfBuy[msg.sender] = 0;
	}

	function getClaimableAmount()
		public
		view
		afterClosed
		onlyWhitelisted
		returns (uint256)
	{
		uint256 balance = balanceOfBuy[msg.sender];
		if (balance == 0 || block.timestamp < cliff) return 0;
		uint256 end = cliff.add(vestingPeriod);
		uint256 duration = (block.timestamp >= end)
			? end.sub(lastClaimed)
			: block.timestamp.sub(lastClaimed);

		return balance.mul(duration).div(vestingPeriod);
	}

	// withdraw raised funds by admin
	function withdrawPayToken() external onlyOwner afterClosed {
		require(amountTotalPaid > 0, "withdraw paytoken amount is zero.");
		payToken.transfer(owner(), amountTotalPaid);
	}

	// withdraw remained buy token by admin
	function withdrawBuyToken() external onlyOwner afterClosed {
		uint256 amount = buyToken
			.balanceOf(address(this))
			.add(amountTotalClaimed)
			.sub(amountTotalBought);
		require(amount > 0, "withdraw buytoken amount is zero");
		buyToken.transfer(owner(), amount);
	}

	// deposit buy token to this contract by admin
	function deposit(uint256 amount) external onlyOwner {
		require(amount > 0, "deposit amount is zero.");
		buyToken.transferFrom(msg.sender, address(this), amount);
	}
}
