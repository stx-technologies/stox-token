const SafeMath = artifacts.require('./SafeMath.sol');
const Ownable = artifacts.require('./Ownable.sol');

module.exports = (deployer) => {
    deployer.deploy(SafeMath);
    deployer.deploy(Ownable);
};
