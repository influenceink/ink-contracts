// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PresaleETH is Ownable, ReentrancyGuard {
	using SafeMath for uint256;

	// the maximum amount of tokens to be sold
	uint256 private constant MAXGOAL = 437500000000 * 10**18;

	// duration of vesting (4 years)
	uint256 public vestingDuration = 48 * 30 days;

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

	// the claimed amount of investor's INK
	mapping(address => uint256) public amountClaimed;

	// startTime & end date of the crowdsale
	uint256 public startTime;
	uint256 public endTime;

	// vestingCliff duration
	uint256 public vestingCliff;

	// token price (1 ETH = 100INK)
	uint256 public price = 100;

	// the address of INK token contract
	IERC20 public inkToken;

	// indicates if the crowdsael has been closed already
	bool public presaleClosed = false;

	// min & max amount of ETH per investor
	uint256 public minPayAmount;
	uint256 public maxPayAmount;

	// notifying transfers and the success of the crowdsale
	event GoalReached(uint256 amountRaisedINK);
	event FundsInvested(address backer, uint256 amountETH);

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
		IERC20 _inkToken,
		uint256 _startTime,
		uint256 _endTime,
		uint256 _cliff
	) {
		inkToken = _inkToken;
		startTime = _startTime;
		endTime = _endTime;
		vestingCliff = _cliff;
	}

	receive() external payable {
		if (msg.sender != owner()) invest();
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

	// set vesting parameter
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

	// invest ETH by whitelisted user
	function invest() public payable {
		uint256 amountETH = msg.value;
		require(
			presaleClosed == false && block.timestamp < endTime,
			"presale is closed."
		);

		uint256 predictETHAmount = balanceOfETH[msg.sender].add(amountETH);
		require(
			predictETHAmount >= minPayAmount && predictETHAmount <= maxPayAmount,
			"fund is out of range."
		);

		balanceOfETH[msg.sender] = predictETHAmount;
		amountRaisedETH = amountRaisedETH.add(amountETH);

		uint256 amountINK = amountETH.mul(price);
		balanceOfINK[msg.sender] = balanceOfINK[msg.sender].add(amountINK);
		amountRaisedINK = amountRaisedINK.add(amountINK);

		if (amountRaisedINK >= MAXGOAL) {
			presaleClosed = true;
			emit GoalReached(amountRaisedINK);
		}

		emit FundsInvested(msg.sender, amountETH);
	}

	// claim available amount of ink token accroding to vesting strategy by whitelisted user
	function claim() external afterClosed onlyWhitelisted nonReentrant {
		uint256 claimableAmount = getClaimableAmount(msg.sender);
		require(claimableAmount > 0, "claimable amount is zero.");
		inkToken.transfer(msg.sender, claimableAmount);
		amountTotalClaimed.add(claimableAmount);
		amountClaimed[msg.sender] = amountClaimed[msg.sender].add(
			claimableAmount
		);
		if (block.timestamp >= vestingCliff.add(vestingDuration))
			balanceOfINK[msg.sender] = 0;
	}

	function getClaimableAmount(address _addr)
		public
		view
		returns (uint256)
	{
		return unlockedAmount(_addr) - amountClaimed[_addr];
	}

	function unlockedAmount(address _addr) public view returns (uint256) {
		uint256 balance = balanceOfINK[_addr];
		uint256 currentTime = block.timestamp;
		if (balance == 0 || currentTime < vestingCliff) return 0;
		uint256 end = vestingCliff.add(vestingDuration);
		uint256 duration = (currentTime >= end)
			? vestingDuration
			: currentTime.sub(vestingCliff);

		return balance.mul(duration).div(vestingDuration);
	}

	// withdraw raised funds by admin
	function withdrawETH() external onlyOwner afterClosed {
		uint256 balance = address(this).balance;
		require(balance > 0, "withdraw ETH amount is zero.");
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
