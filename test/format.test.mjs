import test from 'node:test';
import assert from 'node:assert/strict';
import { ago, compact, pct, signed, usd, usdCompact, formatInt, shortDate } from '../lib/format.js';

test('compact numbers', () => {
    assert.equal(compact(0), '0');
    assert.equal(compact(999), '999');
    assert.equal(compact(1000), '1K');
    assert.equal(compact(1234), '1.2K');
    assert.equal(compact(48_250), '48.3K');
    assert.equal(compact(2_500_000), '2.5M');
    assert.equal(compact(NaN), '–');
    assert.equal(usdCompact(48_250), '$48.3K');
});

test('money, percent and signs', () => {
    assert.equal(usd(1234.5), '$1,235');
    assert.equal(usd(null), '–');
    assert.equal(pct(0.724), '72%');
    assert.equal(pct(0.7249, 1), '72.5%');
    assert.equal(pct(null), '–');
    assert.equal(signed(3), '+3');
    assert.equal(signed(-1200), '-1,200');
    assert.equal(signed(0), '0');
    assert.equal(formatInt(12345), '12,345');
});

test('ago reads naturally', () => {
    const now = new Date('2026-10-21T12:00:00Z');
    assert.equal(ago('2026-10-21T11:59:58Z', now), 'just now');
    assert.equal(ago('2026-10-21T11:59:00Z', now), '1 minute ago');
    assert.equal(ago('2026-10-21T09:00:00Z', now), '3 hours ago');
    assert.equal(ago('2026-10-18T12:00:00Z', now), '3 days ago');
    assert.equal(ago('2026-07-21T12:00:00Z', now), '3 months ago');
    assert.equal(ago(null, now), 'never');
    assert.equal(ago('garbage', now), 'never');
});

test('shortDate respects the time zone', () => {
    assert.equal(shortDate('2026-10-21T03:00:00Z', 'America/New_York'), 'Oct 20, 2026');
    assert.equal(shortDate('2026-10-21T03:00:00Z', 'UTC'), 'Oct 21, 2026');
    assert.equal(shortDate(null), '–');
});
