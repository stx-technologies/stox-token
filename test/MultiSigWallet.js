import expectThrow from './helpers/expectThrow';
import coder from 'web3/packages/web3-eth-abi/src/index.js';

const StoxSmartToken = artifacts.require('../contracts/StoxSmartToken.sol');
const MultiSigWalletMock = artifacts.require('./heplers/MultiSigWalletMock.sol');

contract('MultiSigWallet', (accounts) => {
    const MAX_OWNER_COUNT = 50;
    const DEFAULT_GAS_PRICE = 100000000000;

    const ERC20_TRANSFER_ABI = {
        name: 'transfer',
        type: 'function',
        inputs: [{
            type: 'address',
            name: 'to'
        },
        {
            type: 'uint256',
            name: 'value'
        }]
    };

    const MULTISIGWALLET_ABI = {
        addOwner: {
            name: 'addOwner',
            type: 'function',
            inputs: [{
                type: 'address',
                name: 'owner'
            }]
        },
        removeOwner: {
            name: 'removeOwner',
            type: 'function',
            inputs: [{
                type: 'address',
                name: 'owner'
            }]
        },
        replaceOwner: {
            name: 'replaceOwner',
            type: 'function',
            inputs: [{
                type: 'address',
                name: 'owner'
            }, {
                type: 'address',
                name: 'newOwner'
            }]
        },
        changeRequirement: {
            name: 'changeRequirement',
            type: 'function',
            inputs: [{
                type: 'uint256',
                name: 'required'
            }]
        }
    };

    describe('construction', async () => {
        context('error', async () => {
            it(`should throw if created with more than ${MAX_OWNER_COUNT} owners`, async () => {
                let owners = [];
                for (let i = 0; i < MAX_OWNER_COUNT + 1; ++i) {
                    owners.push(i + 1);
                }

                await expectThrow(MultiSigWalletMock.new(owners, 2));
            });

            it('should throw if created without any owners', async () => {
                await expectThrow(MultiSigWalletMock.new([], 2));
            });

            it('should throw if created without any requirements', async () => {
                await expectThrow(MultiSigWalletMock.new([accounts[0], accounts[1]], 0));
            });

            it('should throw if created with a requirement larger than the number of owners', async () => {
                await expectThrow(MultiSigWalletMock.new([accounts[0], accounts[1], accounts[2]], 10));
            });

            it('should throw if created with duplicate owners', async () => {
                await expectThrow(MultiSigWalletMock.new([accounts[0], accounts[1], accounts[2], accounts[1]], 3));
            });
        });

        context('success', async () => {
            let owners = [accounts[0], accounts[1], accounts[2]];
            let requirement = 2;

            it('should be initialized with 0 balance', async () => {
                let wallet = await MultiSigWalletMock.new(owners, requirement);

                assert.equal(web3.eth.getBalance(wallet.address), 0);
            });

            it('should initialize owners', async () => {
                let wallet = await MultiSigWalletMock.new(owners, requirement);

                assert.deepEqual(owners.sort(), (await wallet.getOwners()).sort());
            });

            it('should initialize owners\' mapping', async () => {
                let wallet = await MultiSigWalletMock.new(owners, requirement);

                for (let owner of owners) {
                    assert.equal(await wallet.isOwner(owner), true);
                }

                assert.equal(await wallet.isOwner(accounts[9]), false);
            });

            it('should initialize requirement', async () => {
                let wallet = await MultiSigWalletMock.new(owners, requirement);

                assert.equal(requirement, (await wallet.required()).toNumber());
            });

            it('should initialize with empty transaction count', async () => {
                let wallet = await MultiSigWalletMock.new(owners, requirement);

                assert.equal((await wallet.transactionCount()).toNumber(), 0);
            });
        });
    });

    describe('fallback function', async () => {
        let owners = [accounts[0], accounts[1], accounts[2]];
        let requirement = 2;
        let wallet;
        let sender = accounts[3];

        beforeEach(async () => {
            wallet = await MultiSigWalletMock.new(owners, requirement);
        });

        it('should receive ETH', async () => {
            let senderBalance = web3.eth.getBalance(sender);
            let walletBalance = web3.eth.getBalance(wallet.address);
            assert.equal(walletBalance.toNumber(), 0);

            let value = 10000;
            let transaction = await wallet.sendTransaction({from: sender, value: value});
            let gasUsed = DEFAULT_GAS_PRICE * transaction.receipt.gasUsed;

            let senderBalance2 = web3.eth.getBalance(sender);
            assert.equal(senderBalance2.toNumber(), senderBalance.minus(value).minus(gasUsed).toNumber());

            let walletBalance2 = web3.eth.getBalance(wallet.address);
            assert.equal(walletBalance2.toNumber(), walletBalance.plus(value).toNumber());
        });

        it('should receive STX', async () => {
            let token = await StoxSmartToken.new();
            await token.disableTransfers(false);

            let value = 200;
            await token.issue(sender, value);

            let senderBalance = await token.balanceOf(sender);
            let walletBalance = await token.balanceOf(wallet.address);
            assert.equal(senderBalance.toNumber(), value);
            assert.equal(walletBalance.toNumber(), 0);

            await token.transfer(wallet.address, value, {from: sender});

            let senderBalance2 = await token.balanceOf(sender);
            assert.equal(senderBalance2.toNumber(), senderBalance.minus(value).toNumber());

            let walletBalance2 = await token.balanceOf(wallet.address);
            assert.equal(walletBalance2.toNumber(), walletBalance.plus(value).toNumber());
        });
    });

    describe('transaction submission and confirmation', async () => {
        [
            { owners: [accounts[1], accounts[2]], requirement: 1 },
            { owners: [accounts[1], accounts[2]], requirement: 2 },
            { owners: [accounts[1], accounts[2], accounts[3]], requirement: 2 },
            { owners: [accounts[1], accounts[2], accounts[3]], requirement: 3 },
            { owners: [accounts[1], accounts[2], accounts[3], accounts[4]], requirement: 1 },
            { owners: [accounts[1], accounts[2], accounts[3], accounts[4]], requirement: 2 },
            { owners: [accounts[1], accounts[2], accounts[3], accounts[4]], requirement: 3 },
            { owners: [accounts[1], accounts[2], accounts[3], accounts[4]], requirement: 4 },
            { owners: [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]], requirement: 3 }
        ].forEach((spec) => {
            context(`with ${spec.owners.length} owners and requirement of ${spec.requirement}`, async () => {
                let wallet;
                let token;
                let initETHBalance = 10000;
                let initSTXBalance = 12345678;
                let value = 234;
                let sender = spec.owners[0];
                let notOwner = accounts[8];
                let receiver = accounts[9];

                beforeEach(async () => {
                    wallet = await MultiSigWalletMock.new(spec.owners, spec.requirement);
                    await wallet.sendTransaction({value: initETHBalance});
                    assert.equal(web3.eth.getBalance(wallet.address).toNumber(), initETHBalance);

                    token = await StoxSmartToken.new();
                    await token.disableTransfers(false);

                    await token.issue(wallet.address, initSTXBalance);
                    assert.equal((await token.balanceOf(wallet.address)).toNumber(), initSTXBalance);
                });

                describe('submitTransaction', async() => {
                    it('should throw an error, if sent from not an owner', async () => {
                        await expectThrow(wallet.submitTransaction(receiver, value, [], {from: notOwner}));
                    });

                    it('should throw an error, if sent to a 0 address', async () => {
                        await expectThrow(wallet.submitTransaction(null, value, [], {from: sender}));
                    });
                });

                describe('confirmTransaction', async() => {
                    it('should throw an error, if confirming the same transaction after submitting it', async () => {
                        await wallet.submitTransaction(receiver, value, [], {from: sender});

                        let transactionId = await wallet.transactionId();
                        await expectThrow(wallet.confirmTransaction(transactionId, {from: sender}));
                    });

                    if (spec.requirement > 1) {
                        it('should throw an error, if sent from not an owner', async () => {
                            await wallet.submitTransaction(receiver, value, [], {from: sender});
                            let transactionId = await wallet.transactionId();

                            await expectThrow(wallet.confirmTransaction(transactionId, {from: notOwner}));
                        });

                        it('should throw an error, if confirming the same transaction twice', async () => {
                            await wallet.submitTransaction(receiver, value, [], {from: sender});
                            let transactionId = await wallet.transactionId();

                            let confirmer = spec.owners[1];
                            await wallet.confirmTransaction(transactionId, {from: confirmer});

                            await expectThrow(wallet.confirmTransaction(transactionId, {from: confirmer}));
                        });
                    }

                    it('should throw an error, if confirming a non-existing transaction', async () => {
                        await expectThrow(wallet.confirmTransaction(12345, {from: spec.owners[0]}));
                    });
                });

                describe('revokeConfirmation', async () => {
                    if (spec.requirement > 1) {
                        it('should throw an error, if sent from not an owner', async () => {
                            await wallet.submitTransaction(receiver, value, [], {from: sender});
                            let transactionId = await wallet.transactionId();

                            let confirmer = spec.owners[1];
                            await wallet.confirmTransaction(transactionId, {from: confirmer});

                            await expectThrow(wallet.revokeConfirmation(transactionId, {from: notOwner}));
                        });

                        it('should throw an error, if asked to revoke a non-confirmed transaction', async () => {
                            await wallet.submitTransaction(receiver, value, [], {from: sender});
                            let transactionId = await wallet.transactionId();

                            await expectThrow(wallet.revokeConfirmation(transactionId, {from: spec.owners[1]}));
                        });
                    }

                    if (spec.requirement > 2) {
                        it('should revoke a confirmation', async () => {
                            await wallet.submitTransaction(receiver, value, [], {from: sender});
                            let transactionId = await wallet.transactionId();

                            let confirmer = spec.owners[1];
                            await wallet.confirmTransaction(transactionId, {from: confirmer});
                            assert.equal(await wallet.getConfirmationCount(transactionId), 2);

                            await wallet.revokeConfirmation(transactionId, {from: confirmer});
                            assert.equal(await wallet.getConfirmationCount(transactionId), 1);
                        });
                    }

                    it('should throw an error, if asked to revoke an executed transaction', async () => {
                        await wallet.submitTransaction(receiver, value, [], {from: sender});
                        let transactionId = await wallet.transactionId();

                        let confirmations = 1;
                        for (let i = 1; i < spec.owners.length && confirmations < spec.requirement; i++) {
                            await wallet.confirmTransaction(transactionId, {from: spec.owners[i]});
                            confirmations++;
                        }

                        await expectThrow(wallet.revokeConfirmation(transactionId, {from: sender}));
                    });
                });

                let getBalance = async (address, coin) => {
                    switch (coin) {
                        case 'ETH':
                            return web3.eth.getBalance(address);

                        case 'STX':
                            return await token.balanceOf(address);

                        default:
                            throw new Error(`Invalid type: ${type}!`);
                    }
                }

                let submitTransaction = async (receiver, value, from, coin) => {
                    switch (coin) {
                        case 'ETH':
                            return await wallet.submitTransaction(receiver, value, [], {from: from});

                        case 'STX':
                            let params = [receiver, value];
                            let encoded = coder.encodeFunctionCall(ERC20_TRANSFER_ABI, params);

                            return await wallet.submitTransaction(token.address, 0, encoded, {from: from});

                        default:
                            throw new Error(`Invalid type: ${type}!`);
                    }
                }

                [
                    'ETH',
                    'STX'
                ].forEach((coin) => {
                    it(`should only send ${coin} when all confirmations were received`, async () => {
                        let transaction = submitTransaction(receiver, value, spec.owners[0], coin);
                        let transactionId = await wallet.transactionId();

                        let confirmations = 1;

                        for (let i = 1; i < spec.owners.length; i++) {
                            let confirmer = spec.owners[i];

                            let prevWalletBalanace = await getBalance(wallet.address, coin);
                            let prevReceiverBalance = await getBalance(receiver, coin);

                            // If this is not the final confirmation - don't expect any change.
                            if (confirmations < spec.requirement) {
                                assert.equal(await wallet.isConfirmed(transactionId), false);

                                await wallet.confirmTransaction(transactionId, {from: confirmer});
                                confirmations++;
                                assert.equal((await wallet.getConfirmationCount(transactionId)).toNumber(),
                                    confirmations);

                                // Should throw an error if trying to confirm the same transaction twice.
                                await expectThrow(wallet.confirmTransaction(transactionId, {from: confirmer}));

                                let walletBalanace = await getBalance(wallet.address, coin);
                                let receiverBalance = await getBalance(receiver, coin);

                                if (confirmations == spec.requirement) {
                                    assert.equal(await wallet.isConfirmed(transactionId), true);

                                    assert.equal(walletBalanace.toNumber(), prevWalletBalanace.minus(value).toNumber());
                                    assert.equal(receiverBalance.toNumber(), prevReceiverBalance.plus(value).toNumber());
                                } else {
                                    assert.equal(await wallet.isConfirmed(transactionId), false);

                                    assert.equal(walletBalanace.toNumber(), prevWalletBalanace.toNumber());
                                    assert.equal(receiverBalance.toNumber(), prevReceiverBalance.toNumber());
                                }
                            } else {
                                assert.equal(await wallet.isConfirmed(transactionId), true);

                                // Should throw an error if trying to confirm an already executed transaction.
                                await expectThrow(wallet.confirmTransaction(transactionId, {from: confirmer}));

                                let walletBalanace = await getBalance(wallet.address, coin);
                                let receiverBalance = await getBalance(receiver, coin);

                                assert.equal(walletBalanace.toNumber(), prevWalletBalanace.toNumber());
                                assert.equal(receiverBalance.toNumber(), prevReceiverBalance.toNumber());
                            }
                        }
                    });
                });
            });
        });
    });

    describe('internal methods', async () => {
        let wallet;

        [
            { owners: [accounts[1], accounts[2]], requirement: 1 },
            { owners: [accounts[1], accounts[2]], requirement: 2 },
            { owners: [accounts[1], accounts[2], accounts[3]], requirement: 2 },
            { owners: [accounts[1], accounts[2], accounts[3]], requirement: 3 },
            { owners: [accounts[1], accounts[2], accounts[3], accounts[4]], requirement: 1 },
            { owners: [accounts[1], accounts[2], accounts[3], accounts[4]], requirement: 2 },
            { owners: [accounts[1], accounts[2], accounts[3], accounts[4]], requirement: 3 },
            { owners: [accounts[1], accounts[2], accounts[3], accounts[4]], requirement: 4 },
            { owners: [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]], requirement: 3 }
        ].forEach((spec) => {
            context(`with ${spec.owners.length} owners and requirement of ${spec.requirement}`, async () => {
                let wallet;
                let notOwner = accounts[8];
                let notOwner2 = accounts[9];

                beforeEach(async () => {
                    wallet = await MultiSigWalletMock.new(spec.owners, spec.requirement);
                });

                describe('addOwner', async () => {
                    let addOwner = async (owner, from) => {
                        let params = [owner];
                        let encoded = coder.encodeFunctionCall(MULTISIGWALLET_ABI.addOwner, params);

                        let transaction = await wallet.submitTransaction(wallet.address, 0, encoded, {from: from});
                        let transactionId = await wallet.transactionId();

                        let confirmations = 1;

                        for (let i = 1; i < spec.owners.length; i++) {
                            let confirmer = spec.owners[i];

                            // If this is not the final confirmation - confirm.
                            if (confirmations < spec.requirement) {
                                transaction = await wallet.confirmTransaction(transactionId, {from: confirmer});
                                confirmations++;
                            }
                        }

                        for (let log of transaction.logs) {
                            if (log.event === 'ExecutionFailure') {
                                throw new Error('invalid opcode');
                            }
                        }
                    };

                    it('should throw an error, if called directly', async () => {
                        await expectThrow(wallet.addOwner(notOwner, {from: spec.owners[0]}));
                    });

                    it('should throw an error, if called by not an owner', async () => {
                        await expectThrow(addOwner(notOwner2, notOwner));
                    });

                    it('should throw an error, if adding an empty owner', async () => {
                        await expectThrow(addOwner('0000000000000000000000000000000000000000', spec.owners[0]));
                    });

                    it('should throw an error, if adding an existing owner', async () => {
                        await expectThrow(addOwner(spec.owners[1], spec.owners[0]));
                    });

                    it('should add an owner', async () => {
                        assert.equal(await wallet.isOwner(notOwner), false);

                        await addOwner(notOwner, spec.owners[0]);

                        assert.equal(await wallet.isOwner(notOwner), true);
                    });
                });

                describe('removeOwner', async () => {
                    let removeOwner = async (owner, from) => {
                        let params = [owner];
                        let encoded = coder.encodeFunctionCall(MULTISIGWALLET_ABI.removeOwner, params);

                        let transaction = await wallet.submitTransaction(wallet.address, 0, encoded, {from: from});
                        let transactionId = await wallet.transactionId();

                        let confirmations = 1;

                        for (let i = 1; i < spec.owners.length; i++) {
                            let confirmer = spec.owners[i];

                            // If this is not the final confirmation - confirm.
                            if (confirmations < spec.requirement) {
                                transaction = await wallet.confirmTransaction(transactionId, {from: confirmer});
                                confirmations++;
                            }
                        }

                        for (let log of transaction.logs) {
                            if (log.event === 'ExecutionFailure') {
                                throw new Error('invalid opcode');
                            }
                        }
                    };

                    it('should throw an error, if called directly', async () => {
                        await expectThrow(wallet.removeOwner(spec.owners[0], {from: spec.owners[0]}));
                    });

                    it('should throw an error, if called by not an owner', async () => {
                        await expectThrow(removeOwner(spec.owners[0], notOwner));
                    });

                    it('should throw an error, if removing a non-existing owner', async () => {
                        await expectThrow(removeOwner(notOwner, spec.owners[0]));
                    });

                    it('should remove an owner', async () => {
                        let owner = spec.owners[1];
                        let requirement = (await wallet.required()).toNumber();

                        assert.equal(await wallet.isOwner(owner), true);

                        await removeOwner(owner, spec.owners[0]);

                        let newRequirement = (await wallet.required()).toNumber();
                        if (spec.requirement > spec.owners.length - 1) {
                            assert.equal(newRequirement, requirement - 1);
                        } else {
                            assert.equal(newRequirement, requirement);
                        }

                        assert.equal(await wallet.isOwner(owner), false);
                    });
                });

                describe('replaceOwner', async () => {
                    let replaceOwner = async (owner, newOwner, from) => {
                        let params = [owner, newOwner];
                        let encoded = coder.encodeFunctionCall(MULTISIGWALLET_ABI.replaceOwner, params);

                        let transaction = await wallet.submitTransaction(wallet.address, 0, encoded, {from: from});
                        let transactionId = await wallet.transactionId();

                        let confirmations = 1;

                        for (let i = 1; i < spec.owners.length; i++) {
                            let confirmer = spec.owners[i];

                            // If this is not the final confirmation - confirm.
                            if (confirmations < spec.requirement) {
                                transaction = await wallet.confirmTransaction(transactionId, {from: confirmer});
                                confirmations++;
                            }
                        }

                        for (let log of transaction.logs) {
                            if (log.event === 'ExecutionFailure') {
                                throw new Error('invalid opcode');
                            }
                        }
                    };

                    it('should throw an error, if called directly', async () => {
                        await expectThrow(wallet.replaceOwner(spec.owners[0], spec.owners[1], {from: spec.owners[0]}));
                    });

                    it('should throw an error, if called by not an owner', async () => {
                        await expectThrow(replaceOwner(spec.owners[0], spec.owners[1], notOwner));
                    });

                    it('should throw an error, if replacing a non-existing owner', async () => {
                        await expectThrow(replaceOwner(notOwner, spec.owners[1], spec.owners[0]));
                    });

                    it('should replace an owner', async () => {
                        let owner = spec.owners[1];
                        let requirement = (await wallet.required()).toNumber();

                        assert.equal(await wallet.isOwner(owner), true);
                        assert.equal(await wallet.isOwner(notOwner), false);

                        await replaceOwner(owner, notOwner, spec.owners[0]);

                        assert.equal(await wallet.isOwner(owner), false);
                        assert.equal(await wallet.isOwner(notOwner), true);
                    });
                });

                describe('changeRequirement', async () => {
                    let changeRequirement = async (requirement, from) => {
                        let params = [requirement];
                        let encoded = coder.encodeFunctionCall(MULTISIGWALLET_ABI.changeRequirement, params);

                        let transaction = await wallet.submitTransaction(wallet.address, 0, encoded, {from: from});
                        let transactionId = await wallet.transactionId();

                        let confirmations = 1;

                        for (let i = 1; i < spec.owners.length; i++) {
                            let confirmer = spec.owners[i];

                            // If this is not the final confirmation - confirm.
                            if (confirmations < spec.requirement) {
                                transaction = await wallet.confirmTransaction(transactionId, {from: confirmer});
                                confirmations++;
                            }
                        }

                        for (let log of transaction.logs) {
                            if (log.event === 'ExecutionFailure') {
                                throw new Error('invalid opcode');
                            }
                        }
                    };

                    it('should throw an error, if called directly', async () => {
                        let requirement = spec.requirement == 1 ? 2 : spec.requirement - 1;
                        await expectThrow(wallet.changeRequirement(requirement, {from: spec.owners[0]}));
                    });

                    it('should throw an error, if called by not an owner', async () => {
                        let requirement = spec.requirement == 1 ? 2 : spec.requirement - 1;
                        await expectThrow(changeRequirement(requirement, notOwner));
                    });

                    if (spec.requirement < spec.owners.length) {
                        it('should increase requirement by 1', async () => {
                            let requirement = (await wallet.required()).toNumber();
                            assert.equal(requirement, spec.requirement);

                            await changeRequirement(spec.requirement + 1, spec.owners[0]);

                            requirement = (await wallet.required()).toNumber();
                            assert.equal(requirement, spec.requirement + 1);
                        });
                    } else {
                        it('should decrease requirement by 1', async () => {
                            let requirement = (await wallet.required()).toNumber();
                            assert.equal(requirement, spec.requirement);

                            await changeRequirement(spec.requirement - 1, spec.owners[0]);

                            requirement = (await wallet.required()).toNumber();
                            assert.equal(requirement, spec.requirement - 1);
                        });
                    }
                });
            });
        });
    });
});
