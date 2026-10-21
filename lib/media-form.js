// Reads and checks the New media / Edit media form. Pure: give it a FormData, get back either errors
// or a clean payload. The database checks everything again (supabase/admin.sql plus the table's own
// constraints), so this is about telling the admin what is wrong, field by field, before they submit.
import { MAX_COST_USD, MAX_MODS, cleanCost, cleanMods, cleanText, isUuid, totalCost } from './mods.js';

export const LIMITS = { car_name: 80, vibe: 200, title: 80, tagline: 200, model: 80, prompt: 4000 };
export const DEFAULT_MODEL = 'admin (manual)';

const multiline = (value, max) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);

function parseParts(form, errors) {
    let raw = [];
    try {
        raw = JSON.parse(String(form.get('mods') ?? '[]'));
    } catch {
        errors.mods = 'The parts list could not be read. Reload the page and try again.';
        return { raw: [], mods: [] };
    }
    if (!Array.isArray(raw)) {
        errors.mods = 'The parts list could not be read. Reload the page and try again.';
        return { raw: [], mods: [] };
    }
    if (raw.length > MAX_MODS) {
        errors.mods = `A build can have up to ${MAX_MODS} parts.`;
        return { raw, mods: [] };
    }
    const mods = cleanMods(raw);
    if (raw.length === 0) errors.mods = 'Add at least one part.';
    else if (mods.length < raw.length) errors.mods = 'Every part needs a name. Fill it in or remove the empty row.';
    return { raw, mods };
}

// Returns { values, errors, payload }. `values` is what to show in the form again; `errors` is null
// when everything is fine, and `payload` is then ready for the database.
export function parseMediaForm(form, { creating = false } = {}) {
    const errors = {};
    const values = {
        user_id: String(form.get('user_id') ?? '').trim(),
        car_name: cleanText(form.get('car_name'), LIMITS.car_name),
        vibe: cleanText(form.get('vibe'), LIMITS.vibe),
        title: cleanText(form.get('title'), LIMITS.title),
        tagline: cleanText(form.get('tagline'), LIMITS.tagline),
        model: cleanText(form.get('model'), LIMITS.model),
        prompt: multiline(form.get('prompt'), LIMITS.prompt),
        est_cost_usd: String(form.get('est_cost_usd') ?? '').trim().slice(0, 12),
    };

    if (creating && !isUuid(values.user_id)) errors.user_id = 'Choose who this build belongs to.';
    if (!values.car_name) errors.car_name = 'Name the car.';
    if (!values.vibe) errors.vibe = 'Describe the vibe.';
    if (!values.title) errors.title = 'Give the build a title.';
    if (!values.tagline) errors.tagline = 'Write a one-line tagline.';
    if (!values.model) errors.model = 'Say who or what made this build.';

    const { raw, mods } = parseParts(form, errors);
    values.mods = raw;

    let cost = null;
    if (values.est_cost_usd === '') {
        // Left blank: add the parts up, as long as every part has a price.
        cost = totalCost(mods);
    } else {
        const typed = Number(values.est_cost_usd.replaceAll(',', '').replace(/^\$/, ''));
        cost = Number.isFinite(typed) && typed >= 0 ? cleanCost(typed) : null;
        if (cost === null) errors.est_cost_usd = 'Enter a whole number of dollars, or leave it blank to add up the parts.';
        else if (typed > MAX_COST_USD) errors.est_cost_usd = `The most a build can cost here is $${MAX_COST_USD.toLocaleString('en-US')}.`;
    }

    if (Object.keys(errors).length > 0) return { values, errors, payload: null };

    return {
        values,
        errors: null,
        payload: {
            user_id: values.user_id,
            car_name: values.car_name,
            vibe: values.vibe,
            title: values.title,
            tagline: values.tagline,
            model: values.model,
            prompt: values.prompt,
            mods,
            est_cost_usd: cost,
        },
    };
}

// A database error in words an admin can act on.
export function friendlyDbError(error) {
    const message = error?.message ?? '';
    if (error?.code === '42501') return 'Your account is no longer allowed to do that. Sign in again, or ask an owner to check your superadmin flag.';
    if (message.startsWith('Daily limit')) return `${message} (Mod Squad limits each person's builds and renders per 24 hours.)`;
    if (error?.code === '23514') return 'The database refused one of the values: something is too long, or a link is not one it accepts.';
    if (error?.code === '22023') return message;
    if (error?.code === 'P0002') return 'That build no longer exists. It may have been deleted.';
    if (error?.code === 'PGRST202') return 'The admin functions are missing. Run supabase/admin.sql in the Supabase SQL editor.';
    return 'Could not save. Please try again.';
}
