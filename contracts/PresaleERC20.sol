// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract PresaleERC20 is Ownable {
	using SafeMath for uint256;

	// the maximum amount of tokens to be sold
	uint256 private constant MAXGOAL = 437500000000;

	// duration of vesting
	uint256 public vestingPeriod = 48 * 30 days;

	// how much has been raised by crowdsale (pay token)
	uint256 public amountTotalPaid;

	// how much has been raised by crowdsale (buy token);
	uint256 public amountTotalBought;

	// the balance of investor's pay token
	mapping(address => uint256) public balanceOfPay;

	// the balance of investor's buy token
	mapping(address => uint256) public balanceOfBuy;

	// start & deadline date of the crowdsale
	uint256 public start;
	uint256 public deadline;
	uint256 public end;
	uint256 public lastClaimed;

	// cliff duration
	uint256 public cliff;

	// token price
	uint256 public price = 100;

	// the address of pay token contract
	IERC20 public payToken;

	// the address of buy token contract
	IERC20 public buyToken;

	// indicated if the crowdsale has been closed already
	bool public presaleClosed = false;

	// min & max amount of pay token per investor
	uint256 public minAmount;
	uint256 public maxAmount;

	// lock state of buy token
	bool public lockState = false;

	// notifying transfers and the success of the crowdsale
	event GoalReached(address beneficiary, uint256 amountPaid);
	event FundsTransfer(
		address backer,
		uint256 amount,
		bool isContribution,
		uint256 amountPaid
	);

	modifier afterClosed() {
		require(
			presaleClosed == true || block.timestamp >= deadline,
			"Presale is not closed."
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
		end = _deadline.add(vestingPeriod);
		lastClaimed = _deadline;
	}

	// return balance in pay token of addr
	function checkFundsPaid(address addr)
		external
		view
		onlyOwner
		returns (uint256)
	{
		return balanceOfPay[addr];
	}

	// return balance in buy token of addr
	function checkFundsBuy(address addr)
		external
		view
		onlyOwner
		returns (uint256)
	{
		return balanceOfBuy[addr];
	}

	// set investment range
	function setRange(uint256 _min, uint256 _max) external onlyOwner {
		minAmount = _min;
		maxAmount = _max;
	}

	// set price
	function setPrice(uint256 _price) external onlyOwner {
		price = _price;
	}

	// set vesting parameter by admin
	function setVestingParameter(uint256 _vestingPeriod, uint256 _cliff)
		external
		onlyOwner
	{
		require(
			presaleClosed == false && block.timestamp < deadline,
			"Don't set vesting parameter in presale."
		);
		vestingPeriod = _vestingPeriod;
		cliff = _cliff;
		lastClaimed = deadline.add(cliff);
		end = deadline.add(cliff).add(vestingPeriod);
	}

	// invest pay token by whitelisted user
	function invest(uint256 amountPay) external onlyWhitelisted {
		require(
			presaleClosed == false && block.timestamp < deadline,
			"Presale is closed."
		);
		require(amountPay >= minAmount, "Fund is less than minimum amount.");

		uint256 predictPaidAmount = balanceOfPay[msg.sender].add(amountPay);
		require(
			predictPaidAmount <= maxAmount,
			"Fund is more than maximum amount."
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
		uint256 balance = balanceOfBuy[msg.sender];
		require(balance > 0, "Zero amount paid.");
		require(lockState == true, "Buy token is locked.");
		require(block.timestamp > lastClaimed, "Cliam is not available.");
		uint256 duration;
		if (block.timestamp >= end) {
			duration = end.sub(lastClaimed);
			balanceOfBuy[msg.sender] = 0;
		} else {
			duration = block.timestamp.sub(lastClaimed);
		}
		lastClaimed = block.timestamp;

		uint256 claimableAmount = balance.mul(duration).div(vestingPeriod);
		payToken.transfer(msg.sender, claimableAmount);
	}

	// withdraw raised funds by admin
	function withdrawPayToken() external onlyOwner afterClosed {
		require(amountTotalPaid > 0, "paid amount is zero.");
		payToken.transfer(owner(), amountTotalPaid);
	}

	// deposit buy token to this contract by admin
	function deposit(uint256 amount) external onlyOwner {
		require(amount > 0, "deposit amount is zero.");
		buyToken.transferFrom(msg.sender, address(this), amount);
	}

	// lock/unlock buy token by admin
	function lock(bool _lockState) external onlyOwner {
		lockState = _lockState;
	}
}
