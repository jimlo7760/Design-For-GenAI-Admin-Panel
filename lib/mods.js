// The rules for the list of parts on a build, the same ones Mod Squad applies to the AI's output and
// to owners' edits (lib/mods.js there), so a build saved from the admin panel looks like any other.
// Plain functions only: safe to import from server code, client components and tests.

export const MAX_MODS = 12;
export const MAX_COST_USD = 500_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => typeof value === 'string' && UUID.test(value);

// One line of plain text: no control characters, spaces collapsed, cut to `max` characters.
export function cleanText(value, max) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// A whole-dollar amount from 0 to MAX_COST_USD, or null when the value is not a usable number.
export function cleanCost(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.min(Math.round(number), MAX_COST_USD) : null;
}

// One part, from the AI or from an admin: only the known fields, trimmed and cut to length.
// Returns null when there is no part name.
export function cleanMod(raw) {
    const part = cleanText(raw?.part, 120);
    if (!part) return null;
    const mod = {
        category: cleanText(raw.category, 40) || 'Other',
        part,
        detail: cleanText(raw.detail, 300),
    };
    const cost = cleanCost(raw.cost_usd);
    if (cost !== null) mod.cost_usd = cost;
    if (raw.source === 'you') mod.source = 'you';
    return mod;
}

export function cleanMods(list, max = MAX_MODS) {
    return (Array.isArray(list) ? list : []).map(cleanMod).filter(Boolean).slice(0, max);
}

// The sum of the parts' costs when every part has one, otherwise null.
export function totalCost(mods) {
    if (!Array.isArray(mods) || mods.length === 0) return null;
    let sum = 0;
    for (const mod of mods) {
        if (!Number.isFinite(mod?.cost_usd)) return null;
        sum += mod.cost_usd;
    }
    return sum;
}

// What one part is worth within the build's estimated total. A part the AI priced knows its own cost.
// Builds made before parts were priced one by one only have a total, so each unpriced part gets an
// even share of whatever the priced parts leave over.
export function shareOfTotal(mods, total, index) {
    const own = mods[index]?.cost_usd;
    if (Number.isFinite(own)) return own;
    if (!Number.isFinite(total)) return null;
    const unpriced = mods.filter((mod) => !Number.isFinite(mod?.cost_usd)).length;
    const priced = mods.reduce((sum, mod) => sum + (Number.isFinite(mod?.cost_usd) ? mod.cost_usd : 0), 0);
    return Math.max(0, Math.round((total - priced) / unpriced));
}
