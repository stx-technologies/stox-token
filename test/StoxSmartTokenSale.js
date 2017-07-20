import BigNumber from 'bignumber.js';
import expectThrow from './helpers/expectThrow';
import time from './helpers/time';

const StoxSmartToken = artifacts.require('../contracts/StoxSmartToken.sol');
const StoxSmartTokenSaleMock = artifacts.require('./helpers/StoxSmartTokenSaleMock.sol');

contract('StoxSmartTokenSale', (accounts) => {
    const MINUTE = 60;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const YEAR = 365 * DAY;

    const ETH = Math.pow(10, 18);
    const STX = Math.pow(10, 18);
    const DEFAULT_GAS_PRICE = 100000000000;

    const ETH_PRICE_USD = 227;
    const EXCHANGE_RATE = 200; // 200 STX for ETH
    const TOKEN_SALE_CAP = new BigNumber(30 * Math.pow(10, 6)).div(ETH_PRICE_USD).floor().mul(EXCHANGE_RATE); // $30M worth of STX

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
        let fundRecipient = accounts[8];
        let stoxRecipient = accounts[9];

        it('should be initialized with a valid funding recipient address', async () => {
            await expectThrow(StoxSmartTokenSaleMock.new(null, stoxRecipient, 10, 100));
        });

        it('should be initialized with a valid stox recipient address', async () => {
            await expectThrow(StoxSmartTokenSaleMock.new(fundRecipient, null, 10, 100));
        });

        it('should be initialized with a future starting block', async () => {
            await expectThrow(StoxSmartTokenSaleMock.new(fundRecipient, stoxRecipient, blockNumber - 1, blockNumber + 200));
        });

        it('should be initialized with a valid ending block', async () => {
            await expectThrow(StoxSmartTokenSaleMock.new(fundRecipient, stoxRecipient, blockNumber + 100, blockNumber - 1));
        });

        it('should deploy the StoxSmartToken contract and own it', async () => {
            let sale = await StoxSmartTokenSaleMock.new(fundRecipient, stoxRecipient, blockNumber + 100, blockNumber + 1000);
            let tokenAddress = await sale.stox();
            assert(tokenAddress != 0);

            let token = StoxSmartToken.at(await sale.stox());
            assert.equal(await token.owner(), sale.address);
        });

        it('should be initialized with 0 total sold tokens', async () => {
            let sale = await StoxSmartTokenSaleMock.new(fundRecipient, stoxRecipient, blockNumber + 100, blockNumber + 1000);
            assert.equal((await sale.tokensSold()), 0);
        });

        it('should be initialized as not finalized', async () => {
            let sale = await StoxSmartTokenSaleMock.new(fundRecipient, stoxRecipient, blockNumber + 100, blockNumber + 1000);
            assert.equal((await sale.isFinalized()), false);
        });

        it('should be ownable', async () => {
            let sale = await StoxSmartTokenSaleMock.new(fundRecipient, stoxRecipient, blockNumber + 100, blockNumber + 100000);
            assert.equal(await sale.owner(), accounts[0]);
        });
    });

    describe('finalize', async () => {
        let sale;
        let token;
        let start;
        let startFrom = 10;
        let end;
        let endTo = 20;
        let fundRecipient = accounts[8];
        let stoxRecipient = accounts[9];

        beforeEach(async () => {
            start = blockNumber + startFrom;
            end = blockNumber + endTo;
            sale = await StoxSmartTokenSaleMock.new(fundRecipient, stoxRecipient, start, end);
            token = StoxSmartToken.at(await sale.stox());
        });

        context('before the ending time', async() => {
            beforeEach(async () => {
                assert(blockNumber < end);
            });

            it('should throw', async () => {
                await expectThrow(sale.finalize());
            });
        });

        let testFinalization = async () => {
            it('should finalize the token sale', async () => {
                assert.equal((await sale.isFinalized()), false);

                await sale.finalize();

                assert.equal((await sale.isFinalized()), true);
            });

            it('should not allow to end a token sale when already ended', async () => {
                await sale.finalize();

                await expectThrow(sale.finalize());
            });
        }

        context('after the ending time', async() => {
            beforeEach(async () => {
                await waitUntilBlockNumber(end + 1);
                assert(web3.eth.blockNumber > end);
            });

            testFinalization();
        });

        context('reached token cap', async () => {
            beforeEach(async () => {
                await sale.setTokensSold(TOKEN_SALE_CAP.toNumber());
            });

            testFinalization();
        });
    });
});
