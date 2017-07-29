pragma solidity ^0.4.11;

import 'bancor-contracts/solidity/contracts/SmartToken.sol';

import './SaferMath.sol';

/// @title Stox Smart Token
contract StoxSmartToken is SmartToken {
    using SaferMath for uint256;

    function StoxSmartToken() SmartToken('Stox', 'STX', 18) {
    }
}
