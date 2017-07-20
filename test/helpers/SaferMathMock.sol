pragma solidity ^0.4.11;

import '../../contracts/SaferMath.sol';

contract SaferMathMock {
    uint public result;

    function multiply(uint a, uint b) {
        result = SaferMath.mul(a, b);
    }

    function subtract(uint a, uint b) {
        result = SaferMath.sub(a, b);
    }

    function add(uint a, uint b) {
        result = SaferMath.add(a, b);
    }

    function divide(uint a, uint b) {
        result = SaferMath.div(a, b);
    }

    function max64(uint64 a, uint64 b) {
        result = SaferMath.max64(a, b);
    }

    function min64(uint64 a, uint64 b) {
        result = SaferMath.min64(a, b);
    }

    function max256(uint256 a, uint256 b) {
        result = SaferMath.max256(a, b);
    }

    function min256(uint256 a, uint256 b) {
        result = SaferMath.min256(a, b);
    }
}
