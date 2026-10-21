import test from 'node:test';
import assert from 'node:assert/strict';
import { logTicks, niceTicks, swarm } from '../lib/scales.js';

test('niceTicks gives round steps that cover the range', () => {
    assert.deepEqual(niceTicks(0, 10, 5), [0, 2, 4, 6, 8, 10]);
    assert.deepEqual(niceTicks(-3, 9, 4), [-5, 0, 5, 10]); // rough step 3 -> next round step is 5
    const t = niceTicks(-17, 42, 5);
    assert.ok(t[0] <= -17 && t.at(-1) >= 42);
    assert.ok(t.includes(0), 'zero is a tick when the range crosses it');
    assert.ok(niceTicks(0, 1234, 5).length <= 7, 'never wildly more ticks than asked for');
    assert.deepEqual(niceTicks(-17, 42, 5), [-20, 0, 20, 40, 60], 'rough step 11.8 -> 20, and the top tick reaches the data');
    assert.deepEqual(niceTicks(0, 7, 5), [0, 2, 4, 6, 8]);
    const flat = niceTicks(5, 5);
    assert.ok(flat.length >= 2 && flat[0] < 5 && flat.at(-1) > 5, 'a flat range still gets an axis around the value');
    assert.ok(flat.every((tick) => Number(tick.toFixed(6)) === tick), 'no floating-point noise');
    assert.deepEqual(niceTicks(NaN, 3), [0, 1]);
});

test('logTicks are powers of ten', () => {
    assert.deepEqual(logTicks(120, 48_000), [100, 1000, 10_000, 100_000]);
    assert.deepEqual(logTicks(1000, 1000), [1000, 10_000]);
});

test('swarm never overlaps and keeps the order and x positions', () => {
    const dots = [];
    for (let i = 0; i < 60; i++) dots.push({ x: 100 + (i % 7) * 3, r: 4 + (i % 4) });
    const out = swarm(dots);
    assert.equal(out.length, dots.length);
    out.forEach((dot, i) => assert.equal(dot.x, dots[i].x));
    for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) {
            const distance = Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y);
            assert.ok(distance >= out[i].r + out[j].r, `dots ${i} and ${j} overlap`);
        }
    }
    assert.equal(out[0].y, 0, 'the first dot sits on the centre line');
});

test('swarm leaves spread-out dots on the centre line', () => {
    const out = swarm([{ x: 0, r: 5 }, { x: 50, r: 5 }, { x: 100, r: 5 }]);
    assert.deepEqual(out.map((d) => d.y), [0, 0, 0]);
});
