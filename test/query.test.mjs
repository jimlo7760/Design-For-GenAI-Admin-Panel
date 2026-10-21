import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSearch, oneOf, pageNumber, withParams } from '../lib/query.js';

test('cleanSearch removes everything that could break out of a PostgREST filter', () => {
    assert.equal(cleanSearch('miata'), 'miata');
    assert.equal(cleanSearch('  m3   e46 '), 'm3 e46');
    // A comma would start a second filter, parentheses would nest one. The underscore goes too: in
    // ILIKE it is a one-character wildcard, so "m_3" would match more than the person typed.
    assert.equal(cleanSearch('x),user_id.eq.1,(y'), 'x user id.eq.1 y');
    assert.equal(cleanSearch('50%*off\\"q"'), '50 off q');
    assert.equal(cleanSearch("o'brien-smith@x.com"), "o'brien-smith@x.com");
    assert.equal(cleanSearch('日本車'), '日本車');
    assert.equal(cleanSearch(['a', 'b']), 'a', 'a repeated parameter takes the first');
    assert.equal(cleanSearch(undefined), '');
    assert.equal(cleanSearch('x'.repeat(200)).length, 60);
});

test('oneOf only accepts known values', () => {
    assert.equal(oneOf('score', ['new', 'score'], 'new'), 'score');
    assert.equal(oneOf('drop table', ['new', 'score'], 'new'), 'new');
    assert.equal(oneOf(undefined, ['new', 'score'], 'new'), 'new');
    assert.equal(oneOf(['score', 'new'], ['new', 'score'], 'new'), 'score');
});

test('pageNumber is a whole number of at least 1', () => {
    assert.equal(pageNumber('3'), 3);
    assert.equal(pageNumber('0'), 1);
    assert.equal(pageNumber('-4'), 1);
    assert.equal(pageNumber('2.9'), 2);
    assert.equal(pageNumber('abc'), 1);
    assert.equal(pageNumber(undefined), 1);
    assert.equal(pageNumber('99999999'), 10_000);
});

test('withParams builds a link, dropping empty values and resetting the page', () => {
    assert.equal(withParams('/media', { q: 'bmw', sort: 'top', page: 4 }, { sort: 'cost' }), '/media?q=bmw&sort=cost');
    assert.equal(withParams('/media', { q: 'bmw' }, { q: '' }), '/media');
    assert.equal(withParams('/media', { q: 'bmw' }, { page: 3 }), '/media?q=bmw&page=3');
    assert.equal(withParams('/media', {}, { page: 1 }), '/media');
});
