import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyDbError, parseMediaForm } from '../lib/media-form.js';

const USER = '11111111-2222-3333-4444-555555555555';
const part = (over = {}) => ({ category: 'Wheels', part: 'Enkei RPF1', detail: 'Light', cost_usd: 1200, ...over });

function form(fields) {
    const f = new FormData();
    for (const [key, value] of Object.entries({
        user_id: USER, car_name: 'Mazda MX-5 Miata (NA)', vibe: 'touge sunday', title: 'Sunday Special', tagline: 'Small car, loud opinions',
        model: 'admin (manual)', est_cost_usd: '', mods: JSON.stringify([part()]), ...fields,
    })) {
        if (value !== undefined) f.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
    return f;
}

test('a good form gives a clean payload, adding up the parts when cost is blank', () => {
    const { errors, payload } = parseMediaForm(form({ mods: [part(), part({ part: 'Header', category: 'Exhaust', cost_usd: 800 })] }), { creating: true });
    assert.equal(errors, null);
    assert.equal(payload.est_cost_usd, 2000);
    assert.equal(payload.user_id, USER);
    assert.deepEqual(payload.mods[1], { category: 'Exhaust', part: 'Header', detail: 'Light', cost_usd: 800 });
});

test('a typed cost wins over the sum, and accepts $ and commas', () => {
    assert.equal(parseMediaForm(form({ est_cost_usd: '$3,500' })).payload.est_cost_usd, 3500);
    assert.equal(parseMediaForm(form({ est_cost_usd: '0' })).payload.est_cost_usd, 0);
});

test('blank cost with an unpriced part leaves the total empty rather than guessing', () => {
    const { payload } = parseMediaForm(form({ mods: [part({ cost_usd: undefined })] }));
    assert.equal(payload.est_cost_usd, null);
});

test('every required field is reported, not just the first', () => {
    const { errors, payload } = parseMediaForm(form({ car_name: '  ', vibe: '', title: '', tagline: '', model: '', mods: [] }), { creating: true });
    assert.equal(payload, null);
    assert.deepEqual(Object.keys(errors).sort(), ['car_name', 'mods', 'model', 'tagline', 'title', 'vibe'].sort());
});

test('the owner is only required when creating, and must be a real id', () => {
    assert.equal(parseMediaForm(form({ user_id: undefined })).errors, null);
    assert.ok(parseMediaForm(form({ user_id: undefined }), { creating: true }).errors.user_id);
    assert.ok(parseMediaForm(form({ user_id: 'not-a-uuid' }), { creating: true }).errors.user_id);
});

test('text is trimmed, collapsed and cut to the limits', () => {
    const { values } = parseMediaForm(form({ car_name: `  BMW   M3 ${'x'.repeat(200)}`, vibe: 'a\u0000b\nc' }));
    assert.equal(values.car_name.length, 80);
    assert.ok(values.car_name.startsWith('BMW M3 x'));
    assert.equal(values.vibe, 'a b c');
});

test('parts: a nameless row, too many rows and junk are all refused', () => {
    assert.match(parseMediaForm(form({ mods: [part(), part({ part: '   ' })] })).errors.mods, /needs a name/);
    assert.match(parseMediaForm(form({ mods: Array.from({ length: 13 }, (_, i) => part({ part: `p${i}` })) })).errors.mods, /up to 12/);
    assert.match(parseMediaForm(form({ mods: '{broken' })).errors.mods, /could not be read/);
    assert.match(parseMediaForm(form({ mods: '"a string"' })).errors.mods, /could not be read/);
    assert.equal(parseMediaForm(form({ mods: Array.from({ length: 12 }, (_, i) => part({ part: `p${i}` })) })).errors, null, '12 parts is allowed');
});

test('parts: only known fields survive, and categories default', () => {
    const { payload } = parseMediaForm(form({ mods: [{ part: 'Intake', category: '', evil: '<script>', cost_usd: '300' }] }));
    assert.deepEqual(payload.mods, [{ category: 'Other', part: 'Intake', detail: '', cost_usd: 300 }]);
});

test('bad costs are explained', () => {
    assert.ok(parseMediaForm(form({ est_cost_usd: 'lots' })).errors.est_cost_usd);
    assert.ok(parseMediaForm(form({ est_cost_usd: '-5' })).errors.est_cost_usd);
    assert.match(parseMediaForm(form({ est_cost_usd: '9999999' })).errors.est_cost_usd, /most a build can cost/);
});

test('database errors become sentences', () => {
    assert.match(friendlyDbError({ code: '42501', message: 'x' }), /no longer allowed/);
    assert.match(friendlyDbError({ code: 'P0001', message: 'Daily limit reached: you can generate 10 builds per 24 hours.' }), /^Daily limit reached.*per 24 hours/);
    assert.match(friendlyDbError({ code: '23514', message: 'x' }), /refused/);
    assert.equal(friendlyDbError({ code: '22023', message: 'The list of parts must have 1 to 12 parts.' }), 'The list of parts must have 1 to 12 parts.');
    assert.match(friendlyDbError({ code: 'PGRST202', message: 'x' }), /admin\.sql/);
    assert.match(friendlyDbError(null), /try again/);
});
