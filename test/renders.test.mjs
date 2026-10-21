import test from 'node:test';
import assert from 'node:assert/strict';
import { isRenderPathFor, renderPath, renderPathFromUrl } from '../lib/renders.js';

const OWNER = '11111111-2222-3333-4444-555555555555';
const BUILD = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const BASE = 'https://abc.supabase.co/storage/v1/object/public/build-renders/';

test('renderPathFromUrl extracts the bucket path from our own URLs only', () => {
    assert.equal(renderPathFromUrl(`${BASE}${OWNER}/${BUILD}.png`), `${OWNER}/${BUILD}.png`);
    assert.equal(renderPathFromUrl(`${BASE}${OWNER}/${BUILD}.png?t=1`), `${OWNER}/${BUILD}.png`);
    assert.equal(renderPathFromUrl(`${BASE}a%20b/c.png`), 'a b/c.png');
    assert.equal(renderPathFromUrl('https://evil.example/x.png'), null);
    assert.equal(renderPathFromUrl(`${BASE}../../secret`), null);
    assert.equal(renderPathFromUrl(`${BASE}%2e%2e/secret`), null);
    assert.equal(renderPathFromUrl(`${BASE}%E0%A4%A`), null, 'malformed escapes are refused, not thrown');
    assert.equal(renderPathFromUrl(null), null);
    assert.equal(renderPathFromUrl(`${BASE}`), null);
});

test('isRenderPathFor accepts only the shape the uploader writes, for that build', () => {
    const good = renderPath(OWNER, BUILD, 'webp', 1_760_000_000_000);
    assert.equal(good, `${OWNER}/${BUILD}-1760000000000.webp`);
    assert.equal(isRenderPathFor(good, BUILD), true);
    assert.equal(isRenderPathFor(good, 'ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee'), false, 'a path for another build');
    assert.equal(isRenderPathFor(`${OWNER}/${BUILD}-1760000000000.gif`, BUILD), false);
    assert.equal(isRenderPathFor(`${OWNER}/../${BUILD}-1760000000000.png`, BUILD), false);
    assert.equal(isRenderPathFor(`${OWNER}/${BUILD}.png`, BUILD), false, 'no timestamp');
    assert.equal(isRenderPathFor(`other/${BUILD}-1760000000000.png`, BUILD), false, 'folder is not a user id');
    assert.equal(isRenderPathFor(good, 'not-a-uuid'), false);
    assert.equal(isRenderPathFor(undefined, BUILD), false);
});
