import BigNumber from 'bignumber.js';
import expectThrow from './helpers/expectThrow';
import time from './helpers/time';

const StoxSmartToken = artifacts.require('../contracts/StoxSmartToken.sol');
const StoxSmartTokenSaleMock = artifacts.require('./helpers/StoxSmartTokenSaleMock.sol');
const Trustee = artifacts.require('../contracts/Trustee.sol');

contract('StoxSmartTokenSale', (accounts) => {
    const MINUTE = 60;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const YEAR = 365 * DAY;

    const ETH = Math.pow(10, 18);
    const STX = Math.pow(10, 18);
    const DEFAULT_GAS_PRICE = 100000000000;

    const ETH_CAP = 148000;
    const EXCHANGE_RATE = 200; // 200 STX for ETH

    const PARTNERS = [
        {address: '0x9065260ef6830f6372F1Bde408DeC57Fe3150530', value: 14800000 * STX}
    ];

    let VESTING_GRANTS = [
        {grantee: '0xb54c6a870d4aD65e23d471Fb7941aD271D323f5E', percent: 25, vesting: 1 * YEAR},
        {grantee: '0x4eB4Cd1D125d9d281709Ff38d65b99a6927b46c1', percent: 20, vesting: 2 * YEAR}
    ];

    let STRATEGIC_PARTNERSHIP_GRANT = {address: '0xbC14105ccDdeAadB96Ba8dCE18b40C45b6bACf58', percent: 55};

    // $30M worth of STX.
    const TOKEN_SALE_CAP = new BigNumber(ETH_CAP).mul(EXCHANGE_RATE).mul(STX);

    let setupTokenSale = async (token, sale) => {
        await token.transferOwnership(sale.address);
        await sale.acceptSmartTokenOwnership();
    };

    let now;

    let increaseTime = async (by) => {
        await time.increaseTime(by);
        now = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    };

    let fundRecipient = accounts[8];
    let token;

    beforeEach(async () => {
        now = web3.eth.getBlock(web3.eth.blockNumber).timestamp;

        token = await StoxSmartToken.new();
    });

    describe('construction', async () => {
        it('should be initialized with a valid token address', async () => {
            await expectThrow(StoxSmartTokenSaleMock.new(null, fundRecipient, now + 100));
        });

        it('should be initialized with a valid funding recipient address', async () => {
            await expectThrow(StoxSmartTokenSaleMock.new(token.address, null, now + 100));
        });

        it('should be initialized with a future starting time', async () => {
            await expectThrow(StoxSmartTokenSaleMock.new(token.address, fundRecipient, now - 1));
        });

        it('should be initialized as not finalized', async () => {
            let sale = await StoxSmartTokenSaleMock.new(token.address, fundRecipient, now + 100);
            assert.equal(await sale.isFinalized(), false);
        });

        it('should be initialized as not distributed', async () => {
            let sale = await StoxSmartTokenSaleMock.new(token.address, fundRecipient, now + 100);
            assert.equal(await sale.isDistributed(), false);
        });

        it('should be initialized without a trustee', async () => {
            let sale = await StoxSmartTokenSaleMock.new(token.address, fundRecipient, now + 100);
            await setupTokenSale(token, sale);

            assert.equal(await sale.trustee(), 0);
        });

        it('should be ownable', async () => {
            let sale = await StoxSmartTokenSaleMock.new(token.address, fundRecipient, now + 100);
            await setupTokenSale(token, sale);

            assert.equal(await sale.owner(), accounts[0]);
        });

        describe('token', async () => {
            let sale;

            beforeEach(async () => {
                sale = await StoxSmartTokenSaleMock.new(token.address, fundRecipient, now + 100);
                await setupTokenSale(token, sale);

                assert.equal(token.address, await sale.stox());
            });

            it('should own the token', async () => {
                assert.equal(await token.owner(), sale.address);
            });

            it('should not be transferable', async () => {
                assert.equal(await token.transfersEnabled(), false);
            });
        });
    });

    describe('distributePartnerTokens', async () => {
        let sale;

        beforeEach(async () => {
            sale = await StoxSmartTokenSaleMock.new(token.address, fundRecipient, now + 100);
        });

        context('with set up token', async() => {
            beforeEach(async () => {
                await setupTokenSale(token, sale);
            });

            it('should be only possible to call by the owner', async () => {
                let notOwner = accounts[8];
                await expectThrow(sale.distributePartnerTokens({from: notOwner}));
            });

            it('should be only possible to called once', async () => {
                await sale.distributePartnerTokens();
                await expectThrow(sale.distributePartnerTokens());
            });

            it('should distribute STX to partners', async () => {
                await sale.distributePartnerTokens();

                let totalPartnersSupply = new BigNumber(0);

                for (let partner of PARTNERS) {
                    assert.equal((await token.balanceOf(partner.address)).toNumber(), partner.value);

                    totalPartnersSupply = totalPartnersSupply.add(partner.value);
                }

                assert.equal((await token.totalSupply()).toNumber(), totalPartnersSupply.toNumber());
                assert.equal((await sale.tokensSold()).toNumber(), totalPartnersSupply.toNumber());
            });
        });

        context('without a set up token', async() => {
            it('should throw', async () => {
                await expectThrow(sale.distributePartnerTokens());
            });
        });
    });

    describe('finalize', async () => {
        let sale;
        let start;
        let startFrom = 1000;
        let end;

        beforeEach(async () => {
            start = now + startFrom;
            end = start + 14 * DAY;
            sale = await StoxSmartTokenSaleMock.new(token.address, fundRecipient, start);
            await setupTokenSale(token, sale);
            await sale.distributePartnerTokens();
        });

        context('before the ending time', async() => {
            beforeEach(async () => {
                assert(now < end);
            });

            it('should throw', async () => {
                await expectThrow(sale.finalize());
            });
        });

        let testFinalization = async () => {
            it('should finalize the token sale', async () => {
                assert.equal(await sale.isFinalized(), false);

                await sale.finalize();

                assert.equal(await sale.isFinalized(), true);
            });

            it('should re-enable the token transfers', async () => {
                assert.equal(await token.transfersEnabled(), false);

                await sale.finalize();

                assert.equal(await token.transfersEnabled(), true);
            });

            it('should not allow to end a token sale when already ended', async () => {
                await sale.finalize();

                await expectThrow(sale.finalize());
            });

            describe('vesting and grants', async () => {
                // We'd allow (up to) 100 seconds of time difference between the execution (i.e., mining) of the
                // contract.
                const MAX_TIME_ERROR = 100;

                let trustee;

                let getGrant = async (address) => {
                    let grant = await trustee.grants(address);

                    return {
                        value: grant[0].toNumber(),
                        start: grant[1].toNumber(),
                        cliff: grant[2].toNumber(),
                        end: grant[3].toNumber(),
                        transferred: grant[4].toNumber(),
                        revokable: grant[5]
                    };
                }

                beforeEach(async () => {
                    let partnershipBalance = (await token.balanceOf(STRATEGIC_PARTNERSHIP_GRANT.address)).toNumber();
                    assert.equal(partnershipBalance, 0);

                    await sale.finalize();

                    trustee = Trustee.at(await sale.trustee());
                });

                for (let grant of VESTING_GRANTS) {
                    it(`should grant ${grant.grantee} ${grant.percent}% over ${grant.vesting}`, async () => {
                        let tokenGrant = await getGrant(grant.grantee);

                        let tokensSold = await sale.tokensSold();
                        let granted = tokensSold.mul(grant.percent).div(100).floor();

                        assert.equal(tokenGrant.value, granted.toNumber());

                        assert.equal(tokenGrant.cliff, tokenGrant.start);
                        assert.equal(tokenGrant.end, tokenGrant.start + grant.vesting);
                        assert.equal(tokenGrant.transferred, 0);
                        assert.equal(tokenGrant.revokable, true);
                    });
                }

                it('should grant the trustee enough tokens to support the grants', async () => {
                    let tokensSold = await sale.tokensSold();
                    let totalGranted = new BigNumber(0);

                    for (let grant of VESTING_GRANTS) {
                        let granted = tokensSold.mul(grant.percent).div(100).floor();

                        totalGranted = totalGranted.add(granted);
                    }

                    let partnerGrant = tokensSold.mul(STRATEGIC_PARTNERSHIP_GRANT.percent).div(100).floor();

                    assert.equal((await token.balanceOf(trustee.address)).toNumber(), totalGranted.toNumber());
                    assert.equal(totalGranted.toNumber(), tokensSold.minus(partnerGrant).toNumber());
                });

                it('should grant strategic partnership grant', async () => {
                    let tokensSold = await sale.tokensSold();

                    let partnersActualGrant = tokensSold.mul(STRATEGIC_PARTNERSHIP_GRANT.percent).div(100).floor().
                        toNumber();

                    let partnershipBalance = (await token.balanceOf(STRATEGIC_PARTNERSHIP_GRANT.address)).toNumber();
                    assert.equal(partnershipBalance, partnersActualGrant);
                });
            });
        }

        context('after the ending time', async() => {
            beforeEach(async () => {
                await increaseTime(YEAR);
            });

            context('sold all of the tokens', async() => {
                beforeEach(async () => {
                    await sale.setTokensSold(TOKEN_SALE_CAP.toNumber());
                });

                testFinalization();
            });

            context('sold only half of the tokens', async() => {
                beforeEach(async () => {
                    await sale.setTokensSold(TOKEN_SALE_CAP.div(2).toNumber());
                });

                testFinalization();
            });
        });

        context('reached token cap', async () => {
            beforeEach(async () => {
                await sale.setTokensSold(TOKEN_SALE_CAP.toNumber());
            });

            testFinalization();
        });
    });

    let verifyTransactions = async (sale, fundRecipient, method, transactions) => {
        let totalTokensSold = await sale.tokensSold();

        let i = 0;
        for (let t of transactions) {
            let tokens = BigNumber.min(new BigNumber(t.value.toString()).mul(EXCHANGE_RATE),
                TOKEN_SALE_CAP.minus(totalTokensSold));

            let contribution = tokens.div(EXCHANGE_RATE).floor();

            console.log(`\t[${++i} / ${transactions.length}] expecting account ${t.from} to buy ` +
                `${tokens.toNumber() / STX} STX for ${t.value / ETH} ETH`);

            if (tokens == 0) {
                await expectThrow(method(sale, t.value, t.from));

                continue;
            }

            let fundRecipientETHBalance = web3.eth.getBalance(fundRecipient);
            let participantETHBalance = web3.eth.getBalance(t.from);
            let participantSTXBalance = await token.balanceOf(t.from);

            let tokensSold = await sale.tokensSold();
            assert.equal(totalTokensSold.toNumber(), tokensSold.toNumber());

            // Perform the transaction.
            let transaction = await method(sale, t.value, t.from);
            let gasUsed = DEFAULT_GAS_PRICE * transaction.receipt.gasUsed;

            let fundRecipientETHBalance2 = web3.eth.getBalance(fundRecipient);
            let participantETHBalance2 = web3.eth.getBalance(t.from);
            let participantSTXBalance2 = await token.balanceOf(t.from);

            totalTokensSold = totalTokensSold.plus(tokens);

            let tokensSold2 = await sale.tokensSold();
            assert.equal(tokensSold2.toNumber(), tokensSold.plus(tokens).toNumber());

            assert.equal(fundRecipientETHBalance2.toNumber(), fundRecipientETHBalance.plus(contribution.toString()).toNumber());
            assert.equal(participantETHBalance2.toNumber(), participantETHBalance.minus(contribution.toString()).minus(gasUsed).toNumber());
            assert.equal(participantSTXBalance2.toNumber(), participantSTXBalance.plus(tokens).toNumber());

            // If the all of the tokens are sold - finalize.
            if (totalTokensSold.equals(TOKEN_SALE_CAP)) {
                console.log('\tFinalizing sale...');

                await sale.finalize();
            }
        }
    };

    let generateTokenTests = async (name, method) => {
        describe(name, async () => {
            let sale;
            let start;
            let startFrom = 1000;
            let value = 1000;

            beforeEach(async () => {
                start = now + startFrom;
                sale = await StoxSmartTokenSaleMock.new(token.address, fundRecipient, start);
                await setupTokenSale(token, sale);
                await sale.distributePartnerTokens();
            });

            context('after the ending time', async() => {
                beforeEach(async () => {
                    await increaseTime(YEAR);
                });

                it('should throw if called after the end fo the sale', async () => {
                    await expectThrow(method(sale, value));
                });
            });

            context('finalized', async () => {
                beforeEach(async () => {
                    await sale.setFinalized(true);

                    assert.equal(await sale.isFinalized(), true);
                });

                it('should not allow to end a token sale when already ended', async () => {
                    await expectThrow(method(sale, value));
                });
            });

            context('reached token cap', async () => {
                beforeEach(async () => {
                    await sale.setTokensSold(TOKEN_SALE_CAP.toNumber());
                    assert.equal((await sale.tokensSold()).toNumber(), TOKEN_SALE_CAP.toNumber());
                });

                it('should throw if reached token cap', async () => {
                    await expectThrow(method(sale, value));
                });
            });

            context('before the start of the sale', async() => {
                beforeEach(async () => {
                    assert(now < start);
                });

                it('should throw if called before the start fo the sale', async () => {
                    await expectThrow(method(sale, value));
                });
            });

            context('during the token sale', async () => {
                // Please note that we'd only have (end - start) blocks to run the tests below.
                beforeEach(async () => {
                    await increaseTime(start - now + 1);
                });

                it('should throw if called with 0 ETH', async () => {
                    await expectThrow(method(sale, 0));
                });

                it('should throw if have not distributed tokens to pre-sale participants', async () => {
                    await sale.setDistributed(false);
                    await expectThrow(method(sale, 1000));
                });

                [
                    [
                        { from: accounts[1], value: ETH },
                        { from: accounts[1], value: ETH },
                        { from: accounts[1], value: ETH },
                        { from: accounts[2], value: 150 * ETH }
                    ],
                    [
                        { from: accounts[1], value: ETH },
                        { from: accounts[2], value: 0.9 * ETH },
                        { from: accounts[3], value: 200 * ETH },
                        { from: accounts[2], value: 50 * ETH },
                        { from: accounts[4], value: 0.001 * ETH },
                        { from: accounts[5], value: 12.25 * ETH },
                        { from: accounts[2], value: 0.11 * ETH },
                        { from: accounts[2], value: 15000 * ETH },
                        { from: accounts[1], value: 1.01 * ETH }
                    ],
                    [
                        { from: accounts[1], value: 5 * ETH },
                        { from: accounts[2], value: 300 * ETH },
                        { from: accounts[2], value: 300 * ETH },
                        { from: accounts[2], value: ETH },
                        { from: accounts[4], value: 1000 * ETH },
                        { from: accounts[5], value: 1.91 * ETH },
                        { from: accounts[2], value: 0.1 * ETH },
                        { from: accounts[2], value: 600 * ETH },
                        { from: accounts[1], value: 0.03 * ETH }
                    ],
                    [
                        { from: accounts[3], value: TOKEN_SALE_CAP / STX / EXCHANGE_RATE / 4 * ETH },
                        { from: accounts[3], value: TOKEN_SALE_CAP / STX / EXCHANGE_RATE / 4 * ETH },
                        { from: accounts[3], value: TOKEN_SALE_CAP / STX / EXCHANGE_RATE / 4 * ETH },
                        { from: accounts[3], value: TOKEN_SALE_CAP / STX / EXCHANGE_RATE / 4 * ETH }
                    ],
                    [
                        { from: accounts[3], value: (TOKEN_SALE_CAP / STX / EXCHANGE_RATE * ETH) + 300 * ETH }
                    ],
                    [
                        { from: accounts[3], value: 10000 * ETH },
                        { from: accounts[3], value: (TOKEN_SALE_CAP / STX / EXCHANGE_RATE * ETH) + 300 * ETH }
                    ]
                ].forEach((transactions) => {
                    context(`${JSON.stringify(transactions).slice(0, 200)}...`, async function() {
                        // These are long tests, so we need to  disable timeouts.
                        this.timeout(0);

                        it('should execute sale orders', async () => {
                            await verifyTransactions(sale, fundRecipient, method, transactions);
                        });
                    });
                });
            });
        });
    }

    // Generate tests which check the "create" method.
    generateTokenTests('using the create function', async (sale, value, from) => {
        let account = from || accounts[0];
        return sale.create(account, {value: value, from: account});
    });

    // Generate tests which check the contract's fallback method.
    generateTokenTests('using fallback function', async (sale, value, from) => {
        if (from) {
            return sale.sendTransaction({value: value, from: from});
        }

        return sale.send(value);
    });

    describe('transfer ownership', async () => {
        let sale;
        let trustee;
        let start;
        let startFrom = 1000;

        beforeEach(async () => {
            start = now + startFrom;
            sale = await StoxSmartTokenSaleMock.new(token.address, fundRecipient, start);
            await setupTokenSale(token, sale);
            await sale.distributePartnerTokens();
        });

        let testTransferAndAcceptTokenOwnership = async () => {
            let owner = accounts[0];
            let newOwner = accounts[1];
            let notOwner = accounts[8];

            describe('transferSmartTokenOwnership', async () => {
                it('should be only possible to call by the owner', async () => {
                    await expectThrow(sale.transferSmartTokenOwnership(newOwner, {from: notOwner}));
                });

                it('should transfer ownership', async () => {
                    assert.equal(await token.owner(), sale.address);

                    await sale.transferSmartTokenOwnership(newOwner, {from: owner});
                    assert.equal(await token.owner(), sale.address);

                    await token.acceptOwnership({from: newOwner});
                    assert.equal(await token.owner(), newOwner);

                    // Shouldn't be possible to called twice.
                    await expectThrow(sale.transferSmartTokenOwnership(newOwner, {from: owner}));
                });
            });

            describe('acceptSmartTokenOwnership', async () => {
                it('should be only possible to call by the owner', async () => {
                    await expectThrow(sale.acceptSmartTokenOwnership({from: notOwner}));
                });

                it('should be able to claim ownership back', async () => {
                    assert.equal(await token.owner(), sale.address);

                    await sale.transferSmartTokenOwnership(newOwner, {from: owner});
                    await token.acceptOwnership({from: newOwner});
                    assert.equal(await token.owner(), newOwner);

                    await token.transferOwnership(sale.address, {from: newOwner});
                    assert.equal(await token.owner(), newOwner);

                    await sale.acceptSmartTokenOwnership({from: owner});
                    assert.equal(await token.owner(), sale.address);
                });
            });
        };

        let testTransferAndAcceptTrusteeOwnership = async () => {
            let owner = accounts[0];
            let newOwner = accounts[1];
            let notOwner = accounts[8];

            describe('transferTrusteeOwnership', async () => {
                it('should be only possible to call by the owner', async () => {
                    await expectThrow(sale.transferTrusteeOwnership(newOwner, {from: notOwner}));
                });

                it('should transfer ownership', async () => {
                    assert.equal(await trustee.owner(), sale.address);

                    await sale.transferTrusteeOwnership(newOwner, {from: owner});
                    assert.equal(await trustee.owner(), sale.address);

                    await trustee.acceptOwnership({from: newOwner});
                    assert.equal(await trustee.owner(), newOwner);

                    // Shouldn't be possible to called twice.
                    await expectThrow(sale.transferTrusteeOwnership(newOwner, {from: owner}));
                });
            });

            describe('acceptTrusteeOwnership', async () => {
                it('should be only possible to call by the owner', async () => {
                    await expectThrow(sale.acceptTrusteeOwnership({from: notOwner}));
                });

                it('should be able to claim ownership back', async () => {
                    assert.equal(await trustee.owner(), sale.address);

                    await sale.transferTrusteeOwnership(newOwner, {from: owner});
                    await trustee.acceptOwnership({from: newOwner});
                    assert.equal(await trustee.owner(), newOwner);

                    await trustee.transferOwnership(sale.address, {from: newOwner});
                    assert.equal(await trustee.owner(), newOwner);

                    await sale.acceptTrusteeOwnership({from: owner});
                    assert.equal(await trustee.owner(), sale.address);
                });
            });

        };

        context('during the sale', async () => {
            beforeEach(async () => {
                await increaseTime(start - now + 1);
            });

            testTransferAndAcceptTokenOwnership();
        });

        context('after the sale', async () => {
            context('reached token cap', async() => {
                beforeEach(async () => {
                    await sale.setTokensSold(TOKEN_SALE_CAP.toNumber());
                    await sale.finalize();

                    trustee = Trustee.at(await sale.trustee());
                });

                testTransferAndAcceptTokenOwnership();
                testTransferAndAcceptTrusteeOwnership();
            });

            context('after the ending time', async() => {
                beforeEach(async () => {
                    await increaseTime(YEAR);
                    await sale.finalize();

                    trustee = Trustee.at(await sale.trustee());
                });

                testTransferAndAcceptTokenOwnership();
                testTransferAndAcceptTrusteeOwnership();
            });
        });
    });
});
