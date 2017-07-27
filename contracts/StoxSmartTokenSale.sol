pragma solidity ^0.4.11;

import './SaferMath.sol';
import './Ownable.sol';
import './StoxSmartToken.sol';
import './VestingTrustee.sol';

/// @title Stox Smart Token sale
contract StoxSmartTokenSale is Ownable {
    using SaferMath for uint256;

    bool public isFinalized = false;

    // The address of the STX ERC20 token.
    StoxSmartToken public stox;

    uint256 public startBlock;
    uint256 public endBlock;
    address public fundingRecipient;
    address public stoxRecipient;

    uint256 public tokensSold = 0;

    // TODO: update to the correct values.
    uint256 public constant ETH_PRICE_USD = 227;
    uint256 public constant EXCHANGE_RATE = 200; // 200 STX for ETH
    uint256 public constant PARTNER_TOKENS = 5 * 10 ** 6 * 10 ** 18; // TODO: use real amounts.

    // $30M worth of STX.
    uint256 public constant TOKEN_SALE_CAP = (30 * 10 ** 6 / ETH_PRICE_USD) * EXCHANGE_RATE * 10 ** 18;

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
        if (!(tokensSold >= TOKEN_SALE_CAP || block.number >= endBlock)) {
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

        // Disable transfers during the token sale.
        stox.disableTransfers(true);

        fundingRecipient = _fundingRecipient;
        stoxRecipient = _stoxRecipient;
        startBlock = _startBlock;
        endBlock = _endBlock;

        distributePartnerTokens();
    }

    /// @dev Distributed tokens to the partners who have participated during the pre-sale.
    function distributePartnerTokens() private onlyOwner {
        // TODO: add real partner addresses.
        issueTokens(0x0010230123012010312300102301230120103121, 1 * 10 ** 6 * 10 ** 18);
        issueTokens(0x0010230123012010312300102301230120103122, 2 * 10 ** 6 * 10 ** 18);
        issueTokens(0x0010230123012010312300102301230120103123, (2 * 10 ** 6 - 50) * 10 ** 18);
        issueTokens(0x0010230123012010312300102301230120103124, 50 * 10 ** 18);

        assert(stox.totalSupply() == PARTNER_TOKENS.mul(2));
    }

    /// @dev Finalizes the token sale event.
    function finalize() external onlyAfterSale {
        if (isFinalized) {
            throw;
        }

        // Re-enable transfers after the token sale.
        stox.disableTransfers(false);

        isFinalized = true;
    }

    /// @dev Create and sell tokens to the caller.
    /// @param _recipient address The address of the recipient.
    function create(address _recipient) public payable onlyDuringSale {
        require(msg.value > 0);

        uint256 tokens = SaferMath.min256(msg.value.mul(EXCHANGE_RATE), TOKEN_SALE_CAP.sub(tokensSold));
        uint256 contribution = tokens.div(EXCHANGE_RATE);

        // Transfer the funds to the funding recipient.
        fundingRecipient.transfer(contribution);

        issueTokens(_recipient, tokens);

        // Refund the msg.sender, in the case that not all of its ETH was used. This can happen only when selling the
        // last chunk of STX.
        uint256 refund = msg.value.sub(contribution);
        if (refund > 0) {
            msg.sender.transfer(refund);
        }
    }

    /// @dev Issues tokens for the recipient.
    /// @param _recipient address The address of the recipient.
    /// @param _tokens uint256 The amount of tokens to issue.
    function issueTokens(address _recipient, uint256 _tokens) private {
        // Update total sold tokens.
        tokensSold = tokensSold.add(_tokens);

        // Since only 50% of the tokens will be sold, we will automatically transfer the remainder to the Stox
        // recipient.
        stox.issue(_recipient, _tokens);
        stox.issue(stoxRecipient, _tokens);

        TokensIssued(_recipient, _tokens);
    }

    /// @dev Fallback function that will delegate the request to create.
    function () external payable onlyDuringSale {
        create(msg.sender);
    }
}
