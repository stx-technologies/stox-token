import expectThrow from './helpers/expectThrow';
const SaferMathMock = artifacts.require('./helpers/SaferMathMock.sol');

contract('SaferMath', (accounts) => {
    let saferMath;

    beforeEach(async () => {
        saferMath = await SaferMathMock.new();
    });

    describe('mul', async () => {
        [
            [5678, 1234],
            [2, 0],
            [575689, 123]
        ].forEach((pair) => {
            it(`multiplies ${pair[0]} and ${pair[1]} correctly`, async () => {
                let a = pair[0];
                let b = pair[1];
                await saferMath.multiply(a, b);
                let result = await saferMath.result();
                assert.equal(result, a * b);
            });
        });

        it('should throw an error on multiplication overflow', async () => {
            let a = 115792089237316195423570985008687907853269984665640564039457584007913129639933;
            let b = 2;

            await expectThrow(saferMath.multiply(a, b));
        });
    });

    describe('add', async () => {
        [
            [5678, 1234],
            [2, 0],
            [123, 575689]
        ].forEach((pair) => {
            it(`adds ${pair[0]} and ${pair[1]} correctly`, async () => {
                let a = pair[0];
                let b = pair[1];
                await saferMath.add(a, b);
                let result = await saferMath.result();

                assert.equal(result, a + b);
            });
        });

        it('should throw an error on addition overflow', async () => {
            let a = 115792089237316195423570985008687907853269984665640564039457584007913129639935;
            let b = 1;

            await expectThrow(saferMath.add(a, b));
        });
    });

    describe('sub', async () => {
        [
            [5678, 1234],
            [2, 0],
            [575689, 123]
        ].forEach((pair) => {
            it(`subtracts ${pair[0]} and ${pair[1]} correctly`, async () => {
                let a = pair[0];
                let b = pair[1];
                await saferMath.subtract(a, b);
                let result = await saferMath.result();

                assert.equal(result, a - b);
            });
        });

        it('should throw an error if subtraction result would be negative', async () => {
            let a = 1234;
            let b = 5678;

            await expectThrow(saferMath.subtract(a, b));
        });
    });

    describe('div', () => {
        [
            [5678, 1234],
            [2, 1],
            [123, 575689]
        ].forEach((pair) => {
            it(`divides ${pair[0]} and ${pair[1]} correctly`, async () => {
                let a = pair[0];
                let b = pair[1];
                await saferMath.divide(a, b);
                let result = await saferMath.result();

                assert.equal(result, Math.floor(a / b));
            });
        });

        it('should throw an error on division by 0', async () => {
            let a = 100;
            let b = 0;

            await expectThrow(saferMath.divide(a, b));
        });
    });

    describe('max64', () => {
        [
            [5678, 1234],
            [2, 1],
            [123, 575689]
        ].forEach((pair) => {
            it(`get the max64 of ${pair[0]} and ${pair[1]} correctly`, async () => {
                let a = pair[0];
                let b = pair[1];
                await saferMath.max64(a, b);
                let result = await saferMath.result();

                assert.equal(result, Math.max(a, b));
            });
        });
    });

    describe('min64', () => {
        [
            [5678, 1234],
            [2, 1],
            [123, 575689]
        ].forEach((pair) => {
            it(`get the min64 of ${pair[0]} and ${pair[1]} correctly`, async () => {
                let a = pair[0];
                let b = pair[1];
                await saferMath.min64(a, b);
                let result = await saferMath.result();

                assert.equal(result, Math.min(a, b));
            });
        });
    });

    describe('max256', () => {
        [
            [5678, 1234],
            [2, 1],
            [123, 575689]
        ].forEach((pair) => {
            it(`get the max256 of ${pair[0]} and ${pair[1]} correctly`, async () => {
                let a = pair[0];
                let b = pair[1];
                await saferMath.max256(a, b);
                let result = await saferMath.result();

                assert.equal(result, Math.max(a, b));
            });
        });
    });

    describe('min256', () => {
        [
            [5678, 1234],
            [2, 1],
            [123, 575689]
        ].forEach((pair) => {
            it(`get the min256 of ${pair[0]} and ${pair[1]} correctly`, async () => {
                let a = pair[0];
                let b = pair[1];
                await saferMath.min256(a, b);
                let result = await saferMath.result();

                assert.equal(result, Math.min(a, b));
            });
        });
    });
});
