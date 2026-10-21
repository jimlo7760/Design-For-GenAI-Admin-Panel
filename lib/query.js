// Reading the URL's query string safely. Plain functions, no React.

export const PAGE_SIZE = 25;

// A search term that is safe to drop inside a PostgREST filter string like
// `title.ilike.*term*,car_name.ilike.*term*`: commas, parentheses, quotes, wildcards, backslashes
// and other punctuation could end the filter early or add one of the caller's own. Letters,
// digits, spaces and a few harmless marks are kept.
export function cleanSearch(value) {
    const first = Array.isArray(value) ? value[0] : value;
    return String(first ?? '')
        .normalize('NFKC')
        .replace(/[^\p{L}\p{N} '.\-@+]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
}

// The value if it is one of `allowed`, otherwise `fallback`.
export function oneOf(value, allowed, fallback) {
    const first = Array.isArray(value) ? value[0] : value;
    return allowed.includes(first) ? first : fallback;
}

// A page number from the URL: a whole number from 1 up to `max`.
export function pageNumber(value, max = 10_000) {
    const first = Array.isArray(value) ? value[0] : value;
    const n = Number.parseInt(first, 10);
    return Number.isInteger(n) && n >= 1 ? Math.min(n, max) : 1;
}

// A link back to the same list with some parameters changed ("" or undefined removes one). Resets the
// page unless the caller passes `page` itself.
export function withParams(path, current, changes) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...current, page: undefined, ...changes })) {
        if (value !== undefined && value !== null && value !== '' && value !== 1) params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
}
