import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAIN, EMAIL, cleanDomain, parseRecordForm, recordError } from '../lib/records.js';
import { RESOURCES } from '../lib/resources.js';

const ID = '11111111-2222-3333-4444-555555555555';

function form(fields) {
    const f = new FormData();
    for (const [key, value] of Object.entries(fields)) if (value !== undefined) f.set(key, value);
    return f;
}

test('text and textarea: trimmed, collapsed (text) or kept (textarea), required ones reported', () => {
    const fields = RESOURCES.terms.fields;
    const ok = parseRecordForm(fields, form({ term: '  Boost   pressure ', definition: 'Line one\r\nLine two  ', example: '' }));
    assert.equal(ok.errors, null);
    assert.deepEqual(ok.payload, { term: 'Boost pressure', definition: 'Line one\nLine two', example: null });

    const bad = parseRecordForm(fields, form({ term: '   ', definition: '' }));
    assert.equal(bad.payload, null);
    assert.deepEqual(Object.keys(bad.errors).sort(), ['definition', 'term']);
    assert.equal(bad.errors.term, 'Term is required.');
});

test('values are cut to the field length', () => {
    const { payload } = parseRecordForm(RESOURCES.terms.fields, form({ term: 'x'.repeat(200), definition: 'd' }));
    assert.equal(payload.term.length, 80);
});

test('domains: lower-cased, a leading @ dropped, and only real domain names pass', () => {
    const fields = RESOURCES['allowed-signup-domains'].fields;
    assert.equal(parseRecordForm(fields, form({ domain: ' @Columbia.EDU ' })).payload.domain, 'columbia.edu');
    assert.equal(parseRecordForm(fields, form({ domain: 'mail.cs.columbia.edu' })).payload.domain, 'mail.cs.columbia.edu');
    for (const domain of ['localhost', 'a b.edu', 'columbia', '.edu', 'x..edu', '-a.edu', 'a-.edu', 'https://x.edu', 'x.edu/path', 'a@b.edu', 'x.e']) {
        assert.ok(parseRecordForm(fields, form({ domain })).errors?.domain, `${domain} should be refused`);
    }
    assert.ok(parseRecordForm(fields, form({ domain: '' })).errors.domain);
    assert.equal(cleanDomain('@A.b'), 'a.b');
    assert.ok(DOMAIN.test('xn--bcher-kva.example'));
});

test('emails: lower-cased and shaped like an address', () => {
    const fields = RESOURCES['whitelisted-emails'].fields;
    assert.equal(parseRecordForm(fields, form({ email: ' Friend@Example.COM ' })).payload.email, 'friend@example.com');
    for (const email of ['nope', 'a@b', '@b.com', 'a@', 'a b@c.com', 'a@@b.com', 'x'.repeat(250) + '@b.com']) {
        assert.ok(parseRecordForm(fields, form({ email })).errors?.email, `${email} should be refused`);
    }
    assert.ok(EMAIL.test('a.b+c@sub.example.org'));
});

test('integers: the weight must be a whole number from 0 to 1000', () => {
    const fields = RESOURCES['prompt-chain-mix'].fields;
    assert.equal(parseRecordForm(fields, form({ weight: '40' })).payload.weight, 40);
    assert.equal(parseRecordForm(fields, form({ weight: ' 0 ' })).payload.weight, 0);
    assert.equal(parseRecordForm(fields, form({ weight: '1,000' })).payload.weight, 1000);
    for (const weight of ['', 'abc', '1.5', '-1', '1001', '1e3', '0x10', '99999999999999999999']) {
        assert.ok(parseRecordForm(fields, form({ weight })).errors?.weight, `${JSON.stringify(weight)} should be refused`);
    }
});

test('booleans: a ticked box is true and an absent one is false', () => {
    const fields = RESOURCES['llm-models'].fields;
    const base = { name: 'm', kind: 'text' };
    assert.equal(parseRecordForm(fields, form({ ...base, is_active: 'on' })).payload.is_active, true);
    assert.equal(parseRecordForm(fields, form(base)).payload.is_active, false);
});

test('selects: a fixed list only accepts its own values; a pick-from-another-section accepts an id or nothing', () => {
    const fields = RESOURCES['llm-models'].fields;
    assert.ok(parseRecordForm(fields, form({ name: 'm', kind: 'video' })).errors.kind);
    assert.ok(parseRecordForm(fields, form({ name: 'm', kind: '' })).errors.kind);
    assert.equal(parseRecordForm(fields, form({ name: 'm', kind: 'image' })).payload.kind, 'image');

    assert.equal(parseRecordForm(fields, form({ name: 'm', kind: 'text', provider_id: ID })).payload.provider_id, ID);
    assert.equal(parseRecordForm(fields, form({ name: 'm', kind: 'text', provider_id: '' })).payload.provider_id, null);
    assert.ok(parseRecordForm(fields, form({ name: 'm', kind: 'text', provider_id: "1' or '1'='1" })).errors.provider_id);
});

test('urls: http or https only', () => {
    const fields = RESOURCES['llm-providers'].fields;
    assert.equal(parseRecordForm(fields, form({ name: 'p', base_url: ' https://api.example.com/v1 ' })).payload.base_url, 'https://api.example.com/v1');
    assert.equal(parseRecordForm(fields, form({ name: 'p', base_url: '' })).payload.base_url, null);
    for (const base_url of ['ftp://x.com', 'javascript:alert(1)', 'example.com', 'https://']) {
        assert.ok(parseRecordForm(fields, form({ name: 'p', base_url })).errors?.base_url, `${base_url} should be refused`);
    }
});

test('a payload only ever holds the section’s own fields, whatever else the form carries', () => {
    const { payload } = parseRecordForm(RESOURCES['prompt-chain-mix'].fields, form({ weight: '5', chain_id: ID, id: ID, updated_at: 'x', is_superadmin: 'true' }));
    assert.deepEqual(Object.keys(payload), ['weight']);
});

test('values are handed back so a rejected form can be shown as typed', () => {
    const { values } = parseRecordForm(RESOURCES.terms.fields, form({ term: '', definition: 'kept' }));
    assert.equal(values.definition, 'kept');
});

test('database errors become sentences, and a duplicate points at its field', () => {
    assert.deepEqual(recordError({ code: '23505' }, RESOURCES['allowed-signup-domains']), { errors: { domain: 'That domain is already on the list.' } });
    assert.match(recordError({ code: '42501' }, RESOURCES.terms).error, /no longer allowed/);
    assert.match(recordError({ code: '23503' }, RESOURCES['llm-providers'], 'delete').error, /still used/);
    assert.match(recordError({ code: '23503' }, RESOURCES.terms).error, /no longer exists/);
    assert.match(recordError({ code: '23514' }, RESOURCES.terms).error, /refused/);
    assert.match(recordError({ code: 'PGRST205' }, RESOURCES.terms).error, /week7\.sql/);
    assert.match(recordError({ code: '42P01' }, RESOURCES.terms).error, /week7\.sql/);
    assert.equal(recordError({ code: 'XX000', message: 'secret internals' }, RESOURCES.terms).error, 'Could not save. Please try again.');
    assert.equal(recordError({ code: 'XX000' }, RESOURCES.terms, 'delete').error, 'Could not delete. Please try again.');
});
