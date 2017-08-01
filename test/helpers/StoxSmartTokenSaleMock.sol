pragma solidity ^0.4.11;

import '../../contracts/StoxSmartTokenSale.sol';

contract StoxSmartTokenSaleMock is StoxSmartTokenSale {
    function StoxSmartTokenSaleMock(address _stox, address _fundingRecipient, uint256 _startTime)
        StoxSmartTokenSale(_stox, _fundingRecipient, _startTime) {
    }

    function setTokensSold(uint256 _tokensSold) {
        tokensSold = _tokensSold;
    }

    function setFinalized(bool state) {
        isFinalized = state;
    }

    function setDistributed(bool state) {
        isDistributed = state;
    }
}
