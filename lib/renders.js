// Where AI renders live in Storage, and how to tell a path we made from one someone made up.
// Plain functions: used by the Server Actions, the browser uploader and the tests.
import { isUuid } from './mods.js';

export const RENDER_BUCKET = 'build-renders';
export const RENDER_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const MAX_RENDER_BYTES = 8 * 1024 * 1024; // the bucket's own limit (assignment4_render.sql)

const PUBLIC_MARKER = `/storage/v1/object/public/${RENDER_BUCKET}/`;

// The file path inside the bucket for a render's public URL, or null if the URL is not one of ours.
export function renderPathFromUrl(url) {
    if (typeof url !== 'string') return null;
    const index = url.indexOf(PUBLIC_MARKER);
    if (index < 0) return null;
    let path;
    try {
        path = decodeURIComponent(url.slice(index + PUBLIC_MARKER.length).split('?')[0]);
    } catch {
        return null;
    }
    return path && !path.includes('..') && !path.startsWith('/') ? path : null;
}

// <owner id>/<build id>-<timestamp>.<png|jpg|webp>: the only shape the admin uploader writes. The
// owner folder keeps the same layout Mod Squad uses, so the owner's own tools still understand it.
export function renderPath(ownerId, buildId, extension, stamp = Date.now()) {
    return `${ownerId}/${buildId}-${stamp}.${extension}`;
}

export function isRenderPathFor(path, buildId) {
    if (typeof path !== 'string' || !isUuid(buildId)) return false;
    const match = /^([0-9a-f-]{36})\/([0-9a-f-]{36})-(\d{10,16})\.(png|jpg|webp)$/i.exec(path);
    return Boolean(match && isUuid(match[1]) && match[2].toLowerCase() === buildId.toLowerCase());
}
