pragma solidity ^0.4.11;

import './SaferMath.sol';
import './Ownable.sol';
import './StoxSmartToken.sol';

/// @title Stox Smart Token sale
contract StoxSmartTokenSale is Ownable {
    using SaferMath for uint256;

    // The address of the STX ERC20 token.
    StoxSmartToken public stox;

    uint256 private startBlock;
    uint256 private endBlock;
    address private fundingRecipient;
    address private stoxRecipient;

    uint256 public tokensSold = 0;

    // TODO: update to the correct values.
    uint256 public constant ETH_PRICE_USD = 227;
    uint256 public constant EXCHANGE_RATE = 200; // 200 STX for ETH
    uint256 public constant TOKEN_SALE_CAP = 30 * 10 ** 6 / ETH_PRICE_USD * EXCHANGE_RATE; // $30M worth of STX

    event TokensIssued(address indexed _to, uint256 _tokens);

    /// @dev Throws if called when not during sale.
    modifier onlyDuringSale() {
        if (tokensSold >= TOKEN_SALE_CAP || block.number < startBlock || block.number >= endBlock) {
            throw;
        }

        _;
    }

    /// @dev Throws if called before sale ends.
    modifier onlyAfterSale() {
        if (tokensSold < TOKEN_SALE_CAP && block.number < endBlock) {
            throw;
        }

        _;
    }

    /// @dev Constructor that initializes the sale conditions.
    /// @param _fundingRecipient address The address of the funding recipient.
    /// @param _stoxRecipient address The address of the funding STX recipient.
    /// @param _startBlock uint256 The block that the token sale should start at.
    /// @param _endBlock uint256 The block that the token sale should end at.
    function StoxSmartTokenSale(address _fundingRecipient, address _stoxRecipient, uint256 _startBlock, uint256 _endBlock) {
        require(_fundingRecipient != address(0));
        require(_stoxRecipient != address(0));
        require(_startBlock > block.number);
        require(_endBlock > _startBlock);

        // Deploy new StoxSmartToken contract.
        stox = new StoxSmartToken();

        fundingRecipient = _fundingRecipient;
        stoxRecipient = _stoxRecipient;
        startBlock = _startBlock;
        endBlock = _endBlock;
    }

    /// @dev Create and sell tokens to the caller.
    /// @param _recipient address The address of the recipient.
    function create(address _recipient) payable public onlyDuringSale {
        require(msg.value > 0);

        uint256 tokens = msg.value.mul(EXCHANGE_RATE);

        tokensSold = tokensSold.add(tokens);

        // Since only 50% of the tokens will be sold, we will automatically transfer the remainder to the Stox
        // recipient.
        issueTokens(_recipient, tokens);
        issueTokens(stoxRecipient, tokens);

        // Transfer the funds to the funding recipient.
        fundingRecipient.transfer(msg.value);
    }

    /// @dev Issues tokens for the recipient.
    /// @param _recipient address The address of the recipient.
    /// @param _tokens uint256 The amount of tokens to issue.
    function issueTokens(address _recipient, uint256 _tokens) private {
        stox.issue(_recipient, _tokens);

        TokensIssued(_recipient, _tokens);
    }

    /// @dev Fallback function that will delegate the request to create.
    function () payable external onlyDuringSale {
        create(msg.sender);
    }
}
