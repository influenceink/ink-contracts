// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract PresaleETH is Ownable {
	using SafeMath for uint256;

	// the maximum amount of tokens to be sold
	uint256 private constant MAXGOAL = 437500000000;

	// duration of vesting
	uint256 public vestingPeriod = 48 * 30 days;

	// how much has been raised by crowdsale (in ETH)
	uint256 public amountRaisedETH;

	// how much has been raised by crowdsale (in INK)
	uint256 public amountRaisedINK;

	// how much has been claimed by user (ink token)
	uint256 public amountTotalClaimed;

	// the balance of investor's ETH
	mapping(address => uint256) public balanceOfETH;

	// the balance of investor's INK
	mapping(address => uint256) public balanceOfINK;

	// start & end date of the crowdsale
	uint256 public start;
	uint256 public deadline;
	uint256 public lastClaimed;

	// cliff duration
	uint256 public cliff;

	// token price
	uint256 public price = 100;

	// the address of INK token contract
	IERC20 public inkToken;

	// indicates if the crowdsael has been closed already
	bool public presaleClosed = false;

	// min & max amount of ETH per investor
	uint256 public minAmount;
	uint256 public maxAmount;

	// notifying transfers and the success of the crowdsale
	event GoalReached(address beneficiary, uint256 amountRaisedINK);
	event FundsTransfer(
		address backer,
		uint256 amountETH,
		bool isContribution,
		uint256 amountRaisedETH
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
		IERC20 _inkToken,
		uint256 _start,
		uint256 _deadline
	) {
		inkToken = _inkToken;
		start = _start;
		deadline = _deadline;
		cliff = _deadline;
		lastClaimed = _deadline;
	}

	receive() external payable {
		if (msg.sender != owner()) invest();
	}

	// return invested balance in ETH of addr
	function checkFundsETH(address addr)
		external
		view
		onlyOwner
		returns (uint256)
	{
		return balanceOfETH[addr];
	}

	// return balance in INK of addr
	function checkFundsINK(address addr)
		external
		view
		onlyOwner
		returns (uint256)
	{
		return balanceOfINK[addr];
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

	// set vesting parameter
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

	// invest ETH by whitelisted user
	function invest() public payable {
		uint256 amountETH = msg.value;
		require(
			presaleClosed == false && block.timestamp < deadline,
			"Presale is closed."
		);

		uint256 predictETHAmount = balanceOfETH[msg.sender].add(amountETH);
		require(
			predictETHAmount >= minAmount,
			"Fund is less than minimum amount."
		);

		require(
			predictETHAmount <= maxAmount,
			"Fund is more than maximum amount."
		);

		balanceOfETH[msg.sender] = predictETHAmount;
		amountRaisedETH = amountRaisedETH.add(amountETH);

		uint256 amountINK = amountETH.mul(price);
		balanceOfINK[msg.sender] = balanceOfINK[msg.sender].add(amountINK);
		amountRaisedINK = amountRaisedINK.add(amountINK);

		if (amountRaisedINK >= MAXGOAL) {
			presaleClosed = true;
			emit GoalReached(msg.sender, amountRaisedINK);
		}

		emit FundsTransfer(msg.sender, amountETH, true, amountRaisedETH);
	}

	// claim available amount of ink token accroding to vesting strategy by whitelisted user
	function claim() external afterClosed onlyWhitelisted {
		uint256 balance = balanceOfINK[msg.sender];
		require(balance > 0, "Zero amount paid.");
		require(block.timestamp > lastClaimed, "Cliam is not available.");
		uint256 end = cliff.add(vestingPeriod);
		uint256 duration;
		if (block.timestamp >= end) {
			duration = end.sub(lastClaimed);
			balanceOfINK[msg.sender] = 0;
		} else {
			duration = block.timestamp.sub(lastClaimed);
		}
		lastClaimed = block.timestamp;

		uint256 claimableAmount = balance.mul(duration).div(vestingPeriod);
		inkToken.transfer(msg.sender, claimableAmount);
		amountTotalClaimed.add(claimableAmount);
	}

	// withdraw raised funds by admin
	function withdrawETH() external onlyOwner afterClosed {
		uint256 balance = address(this).balance;
		require(balance > 0, "ETH balance is zero.");
		address payable payableOwner = payable(owner());
		payableOwner.transfer(balance);
	}

	// withdraw remaind ink token by admin
	function withdrawInkToken() external onlyOwner afterClosed {
		uint256 amount = inkToken
			.balanceOf(address(this))
			.add(amountTotalClaimed)
			.sub(amountRaisedINK);
		require(amount > 0, "withdraw inktoken amount is zero");
		inkToken.transfer(owner(), amount);
	}

	// deposit ink token to this contract by admin
	function deposit(uint256 amount) external onlyOwner {
		require(amount > 0, "deposit amount is zero.");
		inkToken.transferFrom(msg.sender, address(this), amount);
	}
}
