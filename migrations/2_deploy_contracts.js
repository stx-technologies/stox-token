const SaferMath = artifacts.require('./SaferMath.sol');
const Ownable = artifacts.require('./Ownable.sol');

const StoxSmartToken = artifacts.require('./StoxSmartToken.sol');

module.exports = (deployer) => {
    deployer.deploy(Ownable);
    deployer.deploy(SaferMath);

    deployer.link(Ownable, StoxSmartToken);
    deployer.link(SaferMath, StoxSmartToken);

    deployer.deploy(StoxSmartToken);
};
