pragma solidity ^0.4.11;

import '../../contracts/StoxSmartTokenSale.sol';

contract StoxSmartTokenSaleMock is StoxSmartTokenSale {
    function StoxSmartTokenSaleMock(address _stox, address _fundingRecipient, uint256 _startBlock, uint256 _endBlock)
        StoxSmartTokenSale(_stox, _fundingRecipient, _startBlock, _endBlock) {
    }

    function setTokensSold(uint256 _tokensSold) {
        tokensSold = _tokensSold;
    }

    function setFinalized(bool state) {
        isFinalized = state;
    }
}
