pragma solidity ^0.4.11;

import './SaferMath.sol';
import './Ownable.sol';
import './StoxSmartToken.sol';
import './Trustee.sol';

/// @title Stox Smart Token sale
contract StoxSmartTokenSale is Ownable {
    using SaferMath for uint256;

    uint256 public constant DURATION = 14 days;

    bool public isFinalized = false;
    bool public isDistributed = false;

    // The address of the STX ERC20 token.
    StoxSmartToken public stox;

    // The address of the token allocation trustee;
    Trustee public trustee;

    uint256 public startTime = 0;
    uint256 public endTime = 0;
    address public fundingRecipient;

    uint256 public tokensSold = 0;

    // TODO: update to the correct values.
    uint256 public constant ETH_CAP = 148000;
    uint256 public constant EXCHANGE_RATE = 200; // 200 STX for ETH
    uint256 public constant TOKEN_SALE_CAP = ETH_CAP * EXCHANGE_RATE * 10 ** 18;

    address public constant STRATEGIC_PARTNERS_AGGREGATED_PRESALE_ADDRESS = 0x9065260ef6830f6372F1Bde408DeC57Fe3150530;
    address public constant STOX_TEAM_ADDRESS = 0x4eB4Cd1D125d9d281709Ff38d65b99a6927b46c1;
    address public constant STOX_LTD_ADDRESS = 0xbC14105ccDdeAadB96Ba8dCE18b40C45b6bACf58;
    address public constant INVEST_ADDRESS = 0xb54c6a870d4aD65e23d471Fb7941aD271D323f5E;

    event TokensIssued(address indexed _to, uint256 _tokens);

    /// @dev Throws if called when not during sale.
    modifier onlyDuringSale() {
        if (tokensSold >= TOKEN_SALE_CAP || now < startTime || now >= endTime) {
            throw;
        }

        _;
    }

    /// @dev Throws if called before sale ends.
    modifier onlyAfterSale() {
        if (!(tokensSold >= TOKEN_SALE_CAP || now >= endTime)) {
            throw;
        }

        _;
    }

    /// @dev Constructor that initializes the sale conditions.
    /// @param _fundingRecipient address The address of the funding recipient.
    /// @param _startTime uint256 The start time of the token sale.
    function StoxSmartTokenSale(address _stox, address _fundingRecipient, uint256 _startTime) {
        require(_stox != address(0));
        require(_fundingRecipient != address(0));
        require(_startTime > now);

        stox = StoxSmartToken(_stox);

        fundingRecipient = _fundingRecipient;
        startTime = _startTime;
        endTime = startTime + DURATION;
    }

    /// @dev Distributed tokens to the partners who have participated during the pre-sale.
    function distributePartnerTokens() external onlyOwner {
        require(!isDistributed);

        assert(tokensSold == 0);
        assert(stox.totalSupply() == 0);

        // Distribute strategic tokens to partners. Please note, that this address doesn't represent a single entity or
        // person and will be only used to distribute tokens to 30~ partners.
        //
        // Please expect to see token transfers from this address in the first 24 hours after the token sale ends.
        issueTokens(STRATEGIC_PARTNERS_AGGREGATED_PRESALE_ADDRESS, 14800000 * 10 ** 18);

        isDistributed = true;
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
        stox.issue(STOX_LTD_ADDRESS, strategicPartnershipTokens);

        // Issue the remaining tokens as vesting grants:
        stox.issue(trustee, unsoldTokens.sub(strategicPartnershipTokens));

        // 25% of the remaining tokens (== 12.5%) go to Invest.com, at uniform 12 months vesting schedule.
        trustee.grant(INVEST_ADDRESS, unsoldTokens.mul(25).div(100), now, now, now.add(1 years), true);

        // 20% of the remaining tokens (== 10%) go to Stox team, at uniform 24 months vesting schedule.
        trustee.grant(STOX_TEAM_ADDRESS, unsoldTokens.mul(20).div(100), now, now, now.add(2 years), true);

        // Re-enable transfers after the token sale.
        stox.disableTransfers(false);

        isFinalized = true;
    }

    /// @dev Create and sell tokens to the caller.
    /// @param _recipient address The address of the recipient.
    function create(address _recipient) public payable onlyDuringSale {
        require(_recipient != address(0));
        require(msg.value > 0);

        assert(isDistributed);

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
