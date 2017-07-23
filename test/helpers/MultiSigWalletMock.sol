pragma solidity ^0.4.11;

import '../../contracts/MultiSigWallet.sol';

contract MultiSigWalletMock is MultiSigWallet {
    uint256 public transactionId;

    function MultiSigWalletMock(address[] _owners, uint _required) MultiSigWallet(_owners, _required) {
    }

    function submitTransaction(address destination, uint value, bytes data) public returns (uint transactionId) {
        transactionId = super.submitTransaction(destination, value, data);
        return transactionId;
    }
}
