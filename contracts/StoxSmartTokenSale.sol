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

    uint256 public ethRaised = 0;
    uint256 public tokensSold = 0;

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
}
