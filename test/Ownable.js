import expectThrow from './helpers/expectThrow';
const Ownable = artifacts.require('../contracts/Ownable.sol');

contract('Ownable', (accounts) => {
    let ownable;

    let owner = accounts[0];
    let newOwner = accounts[1];
    let stranger = accounts[2];

    beforeEach(async () => {
        ownable = await Ownable.new();
    });

    describe('construction', async () => {
        it('should have an owner', async () => {
            assert.equal(await ownable.owner(), owner);
        });

        it('should not have a newOwnerCandidate', async () => {
            assert.equal(await ownable.newOwnerCandidate(), 0);
        });
    });

    describe('ownership transfer', async () => {
        it('should change newOwnerCandidate', async () => {
            await ownable.transferOwnership(newOwner);

            assert.equal(await ownable.newOwnerCandidate(), newOwner);
        });

        it('should not change owner without approving the new owner', async () => {
            await ownable.transferOwnership(newOwner);

            assert.equal(await ownable.owner(), owner);
        });

        it('should change owner after transfer and approval', async () => {
            await ownable.transferOwnership(newOwner);
            await ownable.acceptOwnership({from: newOwner});

            assert.equal(await ownable.owner(), newOwner);
            assert.equal(await ownable.newOwnerCandidate(), 0);
        });

        it('should prevent non-owners from transfering ownership', async () => {
            assert((await ownable.owner()) != stranger);

            await expectThrow(ownable.transferOwnership(newOwner, {from: stranger}));
        });

        it('should prevent transferring ownership to null or 0 address', async () => {
            await expectThrow(ownable.transferOwnership(null, {from: owner}));
            await expectThrow(ownable.transferOwnership(0, {from: owner}));

            assert.equal(owner, await ownable.owner());
        });

        it('should prevent strangers from accepting ownership', async () => {
            await ownable.transferOwnership(newOwner);
            assert.equal(await ownable.newOwnerCandidate(), newOwner);

            await ownable.acceptOwnership({from: stranger});
            assert.equal(await ownable.newOwnerCandidate(), newOwner);
            assert.equal(await ownable.owner(), owner);
        });
    });
});
