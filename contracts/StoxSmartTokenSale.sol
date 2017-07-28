pragma solidity ^0.4.11;

import './SaferMath.sol';
import './Ownable.sol';
import './StoxSmartToken.sol';
import './Trustee.sol';

/// @title Stox Smart Token sale
contract StoxSmartTokenSale is Ownable {
    using SaferMath for uint256;

    bool public isFinalized = false;

    // The address of the STX ERC20 token.
    StoxSmartToken public stox;

    // The address of the token allocation trustee;
    Trustee public trustee;

    uint256 public startBlock;
    uint256 public endBlock;
    address public fundingRecipient;

    uint256 public tokensSold = 0;

    // TODO: update to the correct values.
    uint256 public constant ETH_PRICE_USD = 227;
    uint256 public constant EXCHANGE_RATE = 200; // 200 STX for ETH
    uint256 public constant PARTNER_TOKENS = 4 * 10 ** 6 * 10 ** 18; // TODO: use real amounts.
    uint256 public constant PARTNER_BONUS = 2 * 10 ** 6 * 10 ** 18; // TODO: use real amounts.

    // $30M worth of STX (including tokens which were granted to pre-sale strategic partners).
    uint256 public constant TOKEN_SALE_CAP = (30 * 10 ** 6 / ETH_PRICE_USD) * EXCHANGE_RATE * 10 ** 18 - PARTNER_TOKENS;

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
    /// @param _startBlock uint256 The block that the token sale should start at.
    /// @param _endBlock uint256 The block that the token sale should end at.
    function StoxSmartTokenSale(address _fundingRecipient, uint256 _startBlock, uint256 _endBlock) {
        require(_fundingRecipient != address(0));
        require(_startBlock > block.number);
        require(_endBlock > _startBlock);

        // Deploy new StoxSmartToken contract.
        stox = new StoxSmartToken();

        // Disable transfers during the token sale.
        stox.disableTransfers(true);

        fundingRecipient = _fundingRecipient;
        startBlock = _startBlock;
        endBlock = _endBlock;

        distributePartnerTokens();
    }

    /// @dev Distributed tokens to the partners who have participated during the pre-sale.
    function distributePartnerTokens() private onlyOwner {
        // TODO: add real partner addresses.
        issueTokens(0x0010230123012010312300102301230120103121, 1 * 10 ** 6 * 10 ** 18);
        issueTokens(0x0010230123012010312300102301230120103122, 1 * 10 ** 6 * 10 ** 18);
        issueTokens(0x0010230123012010312300102301230120103123, (2 * 10 ** 6 - 50) * 10 ** 18);
        issueTokens(0x0010230123012010312300102301230120103124, 50 * 10 ** 18);
        issueTokens(0x0010230123012010312300102301230120103125, 2 * 10 ** 6 * 10 ** 18);

        // Don't count the bonus as part of the sale. PARTNER_BONUS of will be deducted from Stox' strategic partnership
        // vesting grant below.
        tokensSold = tokensSold.sub(PARTNER_BONUS);

        assert(tokensSold == PARTNER_TOKENS);
        assert(stox.totalSupply() == PARTNER_TOKENS.add(PARTNER_BONUS));
    }

    /// @dev Finalizes the token sale event.
    function finalize() external onlyAfterSale {
        if (isFinalized) {
            throw;
        }

        // Grant vesting grants.
        //
        // TODO: use real addresses.
        trustee = new Trustee(stox);

        // Since only 50% of the tokens will be sold, we will automatically issue the same amount of sold STX to the
        // trustee.
        uint256 unsoldTokens = tokensSold;

        // Issue 55% of the remaining tokens (== 27.5%) go to strategic parternships.
        uint256 strategicPartnershipTokens = unsoldTokens.mul(55).div(100);

        // Note: we will substract the bonus tokens from this grant, since they were already issued for the pre-sale
        // strategic partners and should've been taken from this allocation.
        stox.issue(0x0010230123012010312300102301230120103129, strategicPartnershipTokens.sub(PARTNER_BONUS));

        // Issue the remaining tokens as vesting grants:
        stox.issue(trustee, unsoldTokens.sub(strategicPartnershipTokens));

        // 25% of the remaining tokens (== 12.5%) go to Invest.com, at uniform 12 months vesting schedule.
        trustee.grant(0x0010230123012010312300102301230120103121, unsoldTokens.mul(25).div(100), now, now,
            now.add(1 years), false);

        // 20% of the remaining tokens (== 10%) go to Stox team, at uniform 24 months vesting schedule.
        trustee.grant(0x0010230123012010312300102301230120103122, unsoldTokens.mul(20).div(100), now, now,
            now.add(2 years), false);

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

        issueTokens(_recipient, tokens);

        // Transfer the funds to the funding recipient.
        fundingRecipient.transfer(contribution);

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

        stox.issue(_recipient, _tokens);

        TokensIssued(_recipient, _tokens);
    }

    /// @dev Fallback function that will delegate the request to create.
    function () external payable onlyDuringSale {
        create(msg.sender);
    }

    /// @dev Proposes to transfer control of the StoxSmartToken contract to a new owner.
    /// @param _newOwnerCandidate address The address to transfer ownership to.
    ///
    /// Note that:
    ///   1. The new owner will need to call StoxSmartToken's acceptOwnership directly in order to accept the ownership.
    ///   2. Calling this method during the token sale will prevent the token sale to continue, since only the owner of
    ///      the StoxSmartToken contract can issue new tokens.
    function transferSmartTokenOwnership(address _newOwnerCandidate) external onlyOwner {
        stox.transferOwnership(_newOwnerCandidate);
    }

    /// @dev Accepts new ownership on behalf of the StoxSmartToken contract. This can be used, by the token sale
    /// contract itself to claim back ownership of the StoxSmartToken contract.
    function acceptSmartTokenOwnership() external onlyOwner {
        stox.acceptOwnership();
    }

    /// @dev Proposes to transfer control of the Trustee contract to a new owner.
    /// @param _newOwnerCandidate address The address to transfer ownership to.
    ///
    /// Note that:
    ///   1. The new owner will need to call Trustee's acceptOwnership directly in order to accept the ownership.
    ///   2. Calling this method during the token sale won't be possible, as the Trustee is only created after its
    ///      finalization.
    function transferTrusteeOwnership(address _newOwnerCandidate) external onlyOwner {
        trustee.transferOwnership(_newOwnerCandidate);
    }

    /// @dev Accepts new ownership on behalf of the Trustee contract. This can be used, by the token sale
    /// contract itself to claim back ownership of the Trustee contract.
    function acceptTrusteeOwnership() external onlyOwner {
        trustee.acceptOwnership();
    }
}
