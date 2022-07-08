// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract INKNFT is ERC721, ERC721Enumerable, Ownable {
	using SafeERC20 for IERC20;
	using Strings for uint256;
	using Counters for Counters.Counter;
	using MerkleProof for bytes32[];

	Counters.Counter private counter;
	bytes32 public merkleRoot;

	uint256 public startTime;
	uint256 public endTime;
	uint256 public mintPrice;
	uint256 public limitPerWallet;
	uint256 public limitPerTx;
	address public payToken;
	string public baseURI;
	uint256 public ownerMintedAmount;
	mapping(address => uint256) public saleBalances;

	modifier ensureWhitelisted(bytes32 _leaf, bytes32[] calldata _proof) {
		require(
			keccak256(abi.encodePacked(msg.sender)) == _leaf,
			"INKNFT: not allowed to call"
		);

		require(
			_proof.verify(merkleRoot, _leaf) == true,
			"INKNFT: not whitelisted"
		);

		_;
	}

	constructor(
		uint256 _startTime,
		uint256 _endTime,
		uint256 _mintPrice,
		uint256 _limitPerWallet,
		uint256 _limitPerTx,
		address _payToken
	) ERC721("Influenceink NFT", "INKNFT") {
		startTime = _startTime;
		endTime = _endTime;
		mintPrice = _mintPrice;
		limitPerWallet = _limitPerWallet;
		limitPerTx = _limitPerTx;
		payToken = _payToken;
	}

	function setPeriod(uint256 _startTime, uint256 _endTime)
		external
		onlyOwner
	{
		startTime = _startTime;
		endTime = _endTime;
	}

	function setMintPrice(uint256 _mintPrice) external onlyOwner {
		mintPrice = _mintPrice;
	}

	function setMintAmountLimits(
		uint256 _limitPerWallet,
		uint256 _limitPerTx
	) external onlyOwner {
		limitPerWallet = _limitPerWallet;
		limitPerTx = _limitPerTx;
	}

	function setPayToken(address _payToken) external onlyOwner {
		require(_payToken != address(0), "INKNFT: token is the zero address");
		payToken = _payToken;
	}

	function setBaseURI(string memory _baseURI) external onlyOwner {
		baseURI = _baseURI;
	}

	function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
		merkleRoot = _merkleRoot;
	}

	function mint(
		address _to,
		uint256 _amount,
		bytes32 _leaf,
		bytes32[] calldata _proof
	) external ensureWhitelisted(_leaf, _proof) {
		require(
			block.timestamp >= startTime && block.timestamp <= endTime,
			"INKNFT: sale is not alive"
		);
		require(
			_amount > 0 && _amount <= limitPerTx,
			"INKNFT: invalid mint amount"
		);
		require(
			saleBalances[msg.sender] + _amount <= limitPerWallet,
			"INKNFT: minting amount exceeds"
		);

		IERC20(payToken).safeTransferFrom(
			msg.sender,
			address(this),
			_amount * mintPrice
		);
		saleBalances[msg.sender] += _amount;
		_batchMint(_to, _amount);
	}

	function ownerMint(address _to, uint256 _amount) external onlyOwner {
		_batchMint(_to, _amount);
		ownerMintedAmount += _amount;
	}

	function withdrawTo(address _to) external onlyOwner {
		require(_to != address(0), "INKNFT: recipient is the zero address");
		IERC20(payToken).safeTransfer(
			_to,
			IERC20(payToken).balanceOf(address(this))
		);
	}

	function _batchMint(address _to, uint256 _amount) internal {
		for (uint256 index = 0; index < _amount; index++) {
			counter.increment();
			super._mint(_to, counter.current());
		}
	}

	function tokenURI(uint256 _tokenId)
		public
		view
		override(ERC721)
		returns (string memory)
	{
		require(_exists(_tokenId), "INKNFT: token not exist");
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
