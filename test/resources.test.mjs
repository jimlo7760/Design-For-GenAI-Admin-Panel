import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RESOURCES, RESOURCE_LIST, recordHref, resourceFor } from '../lib/resources.js';
import { NAV, currentGroup, groupHref, isCurrent } from '../lib/nav.js';

const COLUMN_TYPES = ['title', 'text', 'long', 'int', 'bool', 'date', 'pill', 'link', 'share', 'response', 'user'];
const FIELD_TYPES = ['text', 'textarea', 'int', 'bool', 'select', 'url', 'domain', 'email'];
const STATIC_PAGES = ['/', '/users', '/media', '/images', '/votes'];

// The assignment, one line per bullet: what the admin must be able to do with each.
const ASSIGNMENT = {
    'prompt-chains': 'R',
    'prompt-chain-steps': 'R',
    'prompt-chain-mix': 'RU',
    terms: 'CRUD',
    'generation-requests': 'R',
    'generation-examples': 'CRUD',
    'llm-models': 'CRUD',
    'llm-providers': 'CRUD',
    'llm-responses': 'R',
    'allowed-signup-domains': 'CRUD',
    'whitelisted-emails': 'CRUD',
};

const offers = (resource) => [
    'R',
    resource.ops.create && 'C',
    resource.ops.update && 'U',
    resource.ops.delete && 'D',
].filter(Boolean).sort().join('');

test('every section the assignment lists exists, and offers exactly what it asks for', () => {
    assert.deepEqual(Object.keys(RESOURCES).sort(), Object.keys(ASSIGNMENT).sort());
    for (const [key, verbs] of Object.entries(ASSIGNMENT)) {
        assert.equal(offers(RESOURCES[key]), [...verbs].sort().join(''), `${key} should offer ${verbs}`);
    }
});

test('sections look up by URL segment, and nothing inherited from Object leaks through', () => {
    assert.equal(resourceFor('terms').table, 'terms');
    for (const bad of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'users', 'media', '', undefined, null, ['terms'], 7]) {
        assert.equal(resourceFor(bad), null, `${String(bad)} is not a section`);
    }
    assert.equal(recordHref(RESOURCES.terms, 'abc'), '/terms/abc');
});

test('every section is described completely', () => {
    const keys = new Set();
    for (const resource of RESOURCE_LIST) {
        const where = resource.key;
        assert.match(where, /^[a-z]+(-[a-z]+)*$/, `${where}: key is a plain URL segment`);
        assert.ok(!keys.has(where), `${where}: duplicate key`);
        keys.add(where);

        for (const prop of ['table', 'title', 'noun', 'nouns', 'blurb', 'select']) assert.equal(typeof resource[prop], 'string', `${where}.${prop}`);
        assert.match(resource.table, /^[a-z_]+$/, `${where}: table name is plain`);
        assert.equal(typeof resource.heading, 'function', `${where}.heading`);
        assert.ok(Array.isArray(resource.search), `${where}.search`);
        for (const column of resource.search) assert.match(column, /^[a-z_]+$/, `${where}: search column ${column}`);

        assert.ok(resource.sorts[resource.defaultSort], `${where}: defaultSort exists`);
        for (const [name, sort] of Object.entries(resource.sorts)) {
            assert.equal(typeof sort.label, 'string', `${where}.sorts.${name}.label`);
            assert.ok(sort.order.length > 0 && sort.order.every(([column, ascending]) => /^[a-z_]+$/.test(column) && typeof ascending === 'boolean'), `${where}.sorts.${name}.order`);
        }

        assert.ok(resource.columns.length > 0, `${where}: has columns`);
        assert.equal(resource.columns.filter((c) => c.type === 'title').length, 1, `${where}: exactly one title column`);
        for (const column of [...resource.columns, ...(resource.details ?? [])]) {
            assert.ok(COLUMN_TYPES.includes(column.type ?? 'text'), `${where}.${column.key}: type ${column.type}`);
            assert.equal(typeof column.label, 'string', `${where}.${column.key}.label`);
            if (column.type === 'link') assert.equal(typeof column.href, 'function', `${where}.${column.key}.href`);
        }
    }
});

test('forms: sections that can write have fields, read-only ones have none', () => {
    for (const resource of RESOURCE_LIST) {
        const writes = resource.ops.create || resource.ops.update;
        assert.equal(Boolean(resource.fields?.length), writes, `${resource.key}: fields iff it can create or update`);
        const names = new Set();
        for (const field of resource.fields ?? []) {
            assert.ok(FIELD_TYPES.includes(field.type), `${resource.key}.${field.name}: type`);
            assert.match(field.name, /^[a-z_]+$/, `${resource.key}.${field.name}: name`);
            assert.ok(!names.has(field.name), `${resource.key}: duplicate field ${field.name}`);
            names.add(field.name);
            assert.equal(typeof field.label, 'string');
            if (['text', 'textarea', 'url'].includes(field.type)) assert.ok(field.max > 0, `${resource.key}.${field.name}: text fields have a max`);
            if (field.type === 'select') {
                assert.ok(Boolean(field.choices) !== Boolean(field.optionsFrom), `${resource.key}.${field.name}: choices or optionsFrom`);
                if (field.optionsFrom) assert.ok(RESOURCES[field.optionsFrom], `${resource.key}.${field.name}: optionsFrom exists`);
            }
        }
        if (resource.unique) assert.ok(names.has(resource.unique.field), `${resource.key}: unique field is a form field`);
    }
});

test('the mix can change one thing: the weight', () => {
    assert.deepEqual(RESOURCES['prompt-chain-mix'].fields.map((field) => field.name), ['weight']);
});

test('scopes and related tables point at sections that exist and can be filtered', () => {
    for (const resource of RESOURCE_LIST) {
        for (const [param, scope] of Object.entries(resource.scopes ?? {})) {
            assert.match(param, /^[a-z]+$/);
            assert.ok(scope.from === 'users' || RESOURCES[scope.from], `${resource.key}.scopes.${param}.from`);
            assert.match(scope.column, /^[a-z_]+$/);
        }
        for (const spec of resource.related ?? []) {
            const target = RESOURCES[spec.resource];
            assert.ok(target, `${resource.key}: related ${spec.resource} exists`);
            assert.ok(Object.values(target.scopes ?? {}).some((scope) => scope.column === spec.column), `${resource.key}: ${spec.resource} can be filtered by ${spec.column}`);
        }
    }
});

test('the menu reaches every section, and only real pages', () => {
    const hrefs = NAV.flatMap((entry) => (entry.items ? entry.items.map((item) => item.href) : [entry.href]));
    for (const key of Object.keys(RESOURCES)) assert.ok(hrefs.includes(`/${key}`), `${key} is in the menu`);
    for (const href of hrefs) assert.ok(STATIC_PAGES.includes(href) || RESOURCES[href.slice(1)], `${href} is a page`);
    assert.equal(new Set(hrefs).size, hrefs.length, 'no page is listed twice');
});

test('menu highlighting', () => {
    assert.ok(isCurrent('/prompt-chains/abc/edit', '/prompt-chains'));
    assert.ok(!isCurrent('/prompt-chain-steps', '/prompt-chains'));
    assert.ok(isCurrent('/', '/') && !isCurrent('/users', '/'));
    assert.equal(currentGroup('/llm-providers/x').label, 'Models');
    assert.equal(currentGroup('/images').label, 'Media');
    assert.equal(currentGroup('/terms'), undefined, 'a single page has no second row');
    assert.equal(currentGroup('/'), undefined);
    assert.equal(groupHref(NAV.find((entry) => entry.label === 'Prompts')), '/prompt-chains');
});

// The page offers exactly the verbs the database grants (supabase/week7.sql, section 7), so a button
// can never exist for something the database would refuse, or hide something it allows.
test('what each section offers matches what week7.sql grants', () => {
    const sql = readFileSync(new URL('../supabase/week7.sql', import.meta.url), 'utf8');
    const rows = [...sql.matchAll(/\('([a-z_]+)',\s+(true|false),\s+(true|false),\s+(true|false),\s+(true|false)\)/g)];
    assert.ok(rows.length >= 9, 'found the grant table');
    const grants = Object.fromEntries(rows.map(([, table, select, insert, update, del]) => [table, { select: select === 'true', create: insert === 'true', update: update === 'true', delete: del === 'true' }]));

    for (const resource of RESOURCE_LIST) {
        const grant = grants[resource.table];
        if (!grant) {
            // Not a table: one of the two views, which nobody can write to.
            assert.ok(['generation_requests', 'llm_responses'].includes(resource.table), `${resource.table} has no grants but is not a known view`);
            assert.deepEqual(resource.ops, { create: false, update: false, delete: false }, `${resource.key}: a view is read-only`);
            assert.match(sql, new RegExp(`create or replace view public\\.${resource.table}\\b`));
            continue;
        }
        assert.ok(grant.select, `${resource.table} can be read`);
        assert.equal(resource.ops.create, grant.create, `${resource.table}: create`);
        assert.equal(resource.ops.update, grant.update, `${resource.table}: update`);
        assert.equal(resource.ops.delete, grant.delete, `${resource.table}: delete`);
    }
});
