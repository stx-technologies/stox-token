pragma solidity ^0.4.11;

import 'bancor-contracts/solidity/contracts/SmartToken.sol';

/// @title Stox Smart Token
contract StoxSmartToken is SmartToken {
    function StoxSmartToken() SmartToken('Stox', 'STX', 18) {
        disableTransfers(true);
    }
}
