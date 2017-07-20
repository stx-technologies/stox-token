import BigNumber from 'bignumber.js';
import expectThrow from './helpers/expectThrow';
import time from './helpers/time';

const StoxSmartToken = artifacts.require('../contracts/StoxSmartToken.sol');
const StoxSmartTokenSale = artifacts.require('../contracts/StoxSmartTokenSale.sol');

contract('StoxSmartTokenSale', (accounts) => {
    const MINUTE = 60;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const YEAR = 365 * DAY;

    let ETH = Math.pow(10, 18);
    let STX = Math.pow(10, 18);
    let DEFAULT_GAS_PRICE = 100000000000;

    let waitUntilBlockNumber = async (blockNumber) => {
        console.log(`Mining until block: ${blockNumber}. Please wait for a couple of moments...`);
        while (web3.eth.blockNumber < blockNumber) {
            await time.mine();
        }
    }

    let blockNumber;
    let now;

    beforeEach(async () => {
        blockNumber = web3.eth.blockNumber;
        now = web3.eth.getBlock(blockNumber).timestamp;
    });

    describe('construction', async () => {
        let fundRecipient = accounts[5];
        let stoxRecipient = accounts[9];

        it('should be initialized with a valid funding recipient address', async () => {
            await expectThrow(StoxSmartTokenSale.new(null, stoxRecipient, 10, 100));
        });

        it('should be initialized with a valid stox recipient address', async () => {
            await expectThrow(StoxSmartTokenSale.new(fundRecipient, null, 10, 100));
        });

        it('should be initialized with a future starting block', async () => {
            await expectThrow(StoxSmartTokenSale.new(fundRecipient, stoxRecipient, blockNumber - 1, blockNumber + 200));
        });

        it('should be initialized with a valid ending block', async () => {
            await expectThrow(StoxSmartTokenSale.new(fundRecipient, stoxRecipient, blockNumber + 100, blockNumber - 1));
        });

        it('should deploy the StoxSmartToken contract and own it', async () => {
            let sale = await StoxSmartTokenSale.new(fundRecipient, stoxRecipient, blockNumber + 100, blockNumber + 1000);
            let tokenAddress = await sale.stox();
            assert(tokenAddress != 0);

            let token = StoxSmartToken.at(await sale.stox());
            assert.equal(await token.owner(), sale.address);
        });

        it('should be initialized with 0 total sold tokens', async () => {
            let sale = await StoxSmartTokenSale.new(fundRecipient, stoxRecipient, blockNumber + 100, blockNumber + 1000);
            assert.equal((await sale.tokensSold()), 0);
        });

        it('should be ownable', async () => {
            let sale = await StoxSmartTokenSale.new(fundRecipient, stoxRecipient, blockNumber + 100, blockNumber + 100000);
            assert.equal(await sale.owner(), accounts[0]);
        });
    });
});
