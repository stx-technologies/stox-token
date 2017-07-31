#!/bin/sh

function unify() {
	grep -v '^[pragma|import]' $1 >> Unified.sol
}

echo "pragma solidity ^0.4.11;" > Unified.sol

# Bancor
unify node_modules/bancor-contracts/solidity/contracts/IOwned.sol
unify node_modules/bancor-contracts/solidity/contracts/IERC20Token.sol
unify node_modules/bancor-contracts/solidity/contracts/ITokenHolder.sol
unify node_modules/bancor-contracts/solidity/contracts/ISmartToken.sol
unify node_modules/bancor-contracts/solidity/contracts/SafeMath.sol
unify node_modules/bancor-contracts/solidity/contracts/ERC20Token.sol
unify node_modules/bancor-contracts/solidity/contracts/Owned.sol
unify node_modules/bancor-contracts/solidity/contracts/TokenHolder.sol
unify node_modules/bancor-contracts/solidity/contracts/SmartToken.sol

# Stox
unify contracts/Ownable.sol
unify contracts/SaferMath.sol
unify contracts/StoxSmartToken.sol
unify contracts/Trustee.sol
unify contracts/StoxSmartTokenSale.sol
