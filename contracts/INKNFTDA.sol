// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract INKNFTDA is ERC721, ERC721Enumerable, Ownable {
	using Counters for Counters.Counter;
	using MerkleProof for bytes32[];
	using SafeERC20 for IERC20;
	using Strings for uint256;

	Counters.Counter private counter;

	uint256 public startTime;
	uint256 public duration;
	uint256 public immutable totalAmount;
	uint256 public immutable tokensReservedForOwner;
	uint256 public limitPerWallet;
	uint256 public limitPerTx;
	uint256 public immutable startingPrice;
	uint256 public immutable finalPrice;
	address public payToken;

	mapping(address => uint256) public saleBalances;

	uint256 public tokensMintedForDutchAuction;
	uint256 public tokensMintedByOwner;

	string public baseURI;
	bytes32 public merkleRoot;

	modifier ensureWhitelisted(bytes32[] memory _proof) {
		require(
			_proof.verify(merkleRoot, keccak256(abi.encodePacked(msg.sender))) ==
				true,
			"INKNFT: not whitelisted"
		);
		_;
	}

	constructor(
		uint256 _startTime,
		uint256 _duration,
		uint256 _totalAmount,
		uint256 _tokensReservedForOwner,
		uint256 _limitPerWallet,
		uint256 _limitPerTx,
		uint256 _startingPrice,
		uint256 _finalPrice,
		address _payToken
	) ERC721("Influenceink NFT", "INKNFT") {
		startTime = _startTime;
		duration = _duration;
		totalAmount = _totalAmount;
		tokensReservedForOwner = _tokensReservedForOwner;
		limitPerWallet = _limitPerWallet;
		limitPerTx = _limitPerTx;
		startingPrice = _startingPrice;
		finalPrice = _finalPrice;
		payToken = _payToken;
	}

	function setPeriod(uint256 _startTime, uint256 _duration)
		external
		onlyOwner
	{
		startTime = _startTime;
		duration = _duration;
	}

	function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
		merkleRoot = _merkleRoot;
	}

	function setBaseURI(string calldata _baseURI) external onlyOwner {
		baseURI = _baseURI;
	}

	function setPayToken(address _payToken) external onlyOwner {
		payToken = _payToken;
	}

	function setMintAmountLimits(
		uint256 _limitPerWallet,
		uint256 _limitPerTx
	) external onlyOwner {
		limitPerWallet = _limitPerWallet;
		limitPerTx = _limitPerTx;
	}

	function mintDutchAuction(
		address _to,
		uint256 _amount,
		bytes32[] memory _proof
	) external ensureWhitelisted(_proof) {
		require(
			block.timestamp >= startTime &&
				block.timestamp <= startTime + duration,
			"INKNFT: sale is not alive"
		);
		require(
			_amount > 0 && _amount <= limitPerTx,
			"INKNFT: invalid mint amount"
		);
		require(
			tokensMintedForDutchAuction + _amount <=
				totalAmount - tokensReservedForOwner &&
				saleBalances[msg.sender] + _amount <= limitPerWallet,
			"INKNFT: minting amount exceeds"
		);

		IERC20(payToken).safeTransferFrom(
			msg.sender,
			address(this),
			getCurrentDutchPrice() * _amount
		);
		saleBalances[msg.sender] += _amount;
		tokensMintedForDutchAuction += _amount;
		_batchMint(_to, _amount);
	}

	function ownerMint(address _to, uint256 _amount) external onlyOwner {
		require(
			tokensMintedByOwner + _amount <= tokensReservedForOwner,
			"INKNFT: invalid mint amount"
		);
		_batchMint(_to, _amount);
		tokensMintedByOwner += _amount;
	}

	function withdrawTo(address _to) external onlyOwner {
		require(_to != address(0), "INKNFT: recipient is the zero address");
		IERC20(payToken).safeTransfer(
			_to,
			IERC20(payToken).balanceOf(address(this))
		);
	}

	function _batchMint(address _to, uint256 _amount) internal {
		for (uint256 index; index < _amount; index++) {
			counter.increment();
			super._mint(_to, counter.current());
		}
	}

	function getTimeElapsed() public view returns (uint256) {
		return
			startTime > 0
				? startTime + duration >= block.timestamp
					? block.timestamp - startTime
					: duration
				: 0;
	}

	function getCurrentDutchPrice() public view returns (uint256) {
		return
			startingPrice -
			((startingPrice - finalPrice) * getTimeElapsed()) /
			duration;
	}

	function totalSupplyForDutchAuction() public view returns (uint256) {
		return totalAmount - tokensReservedForOwner;
	}

	function tokenURI(uint256 _tokenId)
		public
		view
		override(ERC721)
		returns (string memory)
	{
		require(_exists(_tokenId) == true, "INKNFT: token not exist");
		return string(abi.encodePacked(baseURI, _tokenId.toString(), ".json"));
	}

	function _beforeTokenTransfer(
		address _from,
		address _to,
		uint256 _tokenId
	) internal override(ERC721, ERC721Enumerable) {
		super._beforeTokenTransfer(_from, _to, _tokenId);
	}

	function supportsInterface(bytes4 _interfaceId)
		public
		view
		override(ERC721, ERC721Enumerable)
		returns (bool)
	{
		return super.supportsInterface(_interfaceId);
	}
}
