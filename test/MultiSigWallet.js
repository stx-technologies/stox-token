import expectThrow from './helpers/expectThrow';

const StoxSmartToken = artifacts.require('../contracts/StoxSmartToken.sol');
const MultiSigWallet = artifacts.require('../contracts/MultiSigWallet.sol');

contract('MultiSigWallet', (accounts) => {
    const MAX_OWNER_COUNT = 50;

    describe('construction', async () => {
        context('error', async () => {
            it(`should throw if created with more than ${MAX_OWNER_COUNT} owners`, async () => {
                await expectThrow(MultiSigWallet.new(Array(MAX_OWNER_COUNT + 1).fill(accounts[2]), 2));
            });

            it('should throw if created without any owners', async () => {
                await expectThrow(MultiSigWallet.new([], 2));
            });

            it('should throw if created without any requirements', async () => {
                await expectThrow(MultiSigWallet.new([accounts[0], accounts[1]], 0));
            });

            it('should throw if created with a requirement larger than the number of owners', async () => {
                await expectThrow(MultiSigWallet.new([accounts[0], accounts[1], accounts[2]], 10));
            });

            it('should throw if created with duplicate owners', async () => {
                await expectThrow(MultiSigWallet.new([accounts[0], accounts[1], accounts[2], accounts[1]], 3));
            });
        });

        context('success', async () => {
            let owners = [accounts[0], accounts[1], accounts[2]];
            let requirement = 2;

            it('should initialize owners', async () => {
                let wallet = await MultiSigWallet.new(owners, requirement);

                assert.deepEqual(owners.sort(), (await wallet.getOwners()).sort());
            });

            it('should initialize owners\' mapping', async () => {
                let wallet = await MultiSigWallet.new(owners, requirement);

                for (let owner of owners) {
                    assert.equal(await wallet.isOwner(owner), true);
                }

                assert.equal(await wallet.isOwner(accounts[9]), false);
            });

            it('should initialize requirement', async () => {
                let wallet = await MultiSigWallet.new(owners, requirement);

                assert.equal(requirement, (await wallet.required()).toNumber());
            });

            it('should initialize with empty transaction count', async () => {
                let wallet = await MultiSigWallet.new(owners, requirement);

                assert.equal((await wallet.transactionCount()).toNumber(), 0);
            });
        });
    });
});
