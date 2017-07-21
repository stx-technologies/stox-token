require('babel-register');
require('babel-polyfill');

let provider;

module.exports = {
    networks: {
        development: {
            host: 'localhost',
            port: 8545,
            network_id: '*' // Match any network id
        },
        ropsten: {
            provider: provider,
            network_id: 3 // official id of the ropsten network
        }
    },
    mocha: {
        useColors: true,
        slow: 30000
    }
};
