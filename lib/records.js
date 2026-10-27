// Reads and checks the create/edit forms of the Week 7 sections (terms, models, domains and so on).
// Pure: give it the field list from lib/resources.js and a FormData, get back either errors or a
// clean payload. The database checks every value again (supabase/week7.sql), so this is about telling
// the admin what is wrong, field by field, before they submit.
import { cleanText, isUuid } from './mods.js';

// The same rules as the check constraints on allowed_signup_domains and whitelisted_emails.
export const DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const multiline = (value, max) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max);

// "Columbia.EDU " and "@columbia.edu" both mean columbia.edu.
export const cleanDomain = (value) => String(value ?? '').trim().toLowerCase().replace(/^@/, '');
export const cleanEmail = (value) => String(value ?? '').trim().toLowerCase();

function cleanUrl(value) {
    const text = String(value ?? '').trim();
    try {
        const url = new URL(text);
        return (url.protocol === 'http:' || url.protocol === 'https:') && text.length <= 300 ? text : null;
    } catch {
        return null;
    }
}

const FALLBACK_MAX = 200;

// Returns { values, errors, payload }. `values` is what to show in the form again; `errors` is null
// when everything is fine (otherwise { fieldName: message }); `payload` is then ready for the table.
// Optional fields that are left blank become null, which clears them on an edit.
export function parseRecordForm(fields, form) {
    const errors = {};
    const values = {};
    const payload = {};

    for (const field of fields) {
        const { name, label } = field;
        const lower = label.toLowerCase();
        const max = field.max ?? FALLBACK_MAX;
        const raw = form.get(name);
        const fail = (message) => { errors[name] = message; };
        const required = (blank) => {
            if (!blank) return false;
            if (field.required) fail(`${label} is required.`);
            payload[name] = null;
            return true;
        };

        switch (field.type) {
            case 'bool': {
                const on = raw === 'on' || raw === 'true';
                values[name] = on;
                payload[name] = on;
                break;
            }

            case 'int': {
                const text = String(raw ?? '').replace(/[\s,]/g, '');
                values[name] = String(raw ?? '').trim().slice(0, 12);
                if (required(text === '')) break;
                const number = Number(text);
                const min = field.min ?? 0;
                const top = field.maxValue ?? 1_000_000;
                if (!/^-?\d+$/.test(text) || !Number.isSafeInteger(number)) fail(`${label} must be a whole number.`);
                else if (number < min || number > top) fail(`${label} must be from ${min} to ${top}.`);
                else payload[name] = number;
                break;
            }

            case 'select': {
                const text = String(raw ?? '').trim();
                values[name] = text;
                if (required(text === '')) break;
                const allowed = field.choices ? field.choices.map(([value]) => value) : null;
                if (allowed ? !allowed.includes(text) : !isUuid(text)) fail(`Choose a valid ${lower}.`);
                else payload[name] = text;
                break;
            }

            case 'domain': {
                const text = cleanDomain(raw);
                values[name] = text;
                if (required(text === '')) break;
                if (!DOMAIN.test(text)) fail('Enter a domain like columbia.edu: letters, numbers, dots and dashes, no spaces.');
                else payload[name] = text;
                break;
            }

            case 'email': {
                const text = cleanEmail(raw);
                values[name] = text;
                if (required(text === '')) break;
                if (text.length > 254 || !EMAIL.test(text)) fail('Enter an email address like name@example.com.');
                else payload[name] = text;
                break;
            }

            case 'url': {
                const text = String(raw ?? '').trim().slice(0, 300);
                values[name] = text;
                if (required(text === '')) break;
                const url = cleanUrl(text);
                if (!url) fail('Enter a full web address starting with http:// or https://.');
                else payload[name] = url;
                break;
            }

            case 'textarea': {
                const text = multiline(raw, max);
                values[name] = text;
                if (!required(text === '')) payload[name] = text;
                break;
            }

            default: {
                const text = cleanText(raw, max);
                values[name] = text;
                if (!required(text === '')) payload[name] = text;
                break;
            }
        }
    }

    if (Object.keys(errors).length > 0) return { values, errors, payload: null };
    return { values, errors: null, payload };
}

// A table that is not there yet: supabase/week7.sql has not been run.
export const isMissingTable = (error) => error?.code === 'PGRST205' || error?.code === '42P01';

// A database error in words an admin can act on. Returns { errors: { field: message } } when it can
// point at one field, otherwise { error: sentence }. `op` is 'save' or 'delete'.
export function recordError(error, resource, op = 'save') {
    const message = error?.message ?? '';
    if (isMissingTable(error)) return { error: 'This section’s tables are missing. Run supabase/week7.sql in the Supabase SQL editor.' };
    if (error?.code === '42501') return { error: 'Your account is no longer allowed to do that. Sign in again, or ask an owner to check your superadmin flag.' };
    if (error?.code === '23505') {
        if (resource.unique) return { errors: { [resource.unique.field]: resource.unique.message } };
        return { error: `That ${resource.noun} already exists.` };
    }
    if (error?.code === '23503') {
        return op === 'delete'
            ? { error: `This ${resource.noun} is still used by something else. Remove or change that first, then delete it.` }
            : { error: 'One of the choices no longer exists. Reload the page and choose again.' };
    }
    if (error?.code === '23514' || error?.code === '22001') return { error: 'The database refused one of the values: something is too long, or not in the right format.' };
    if (error?.code === '22P02') return { error: 'One of the values is not valid.' };
    if (error?.code === '23502') return { error: 'A required field is missing.' };
    if (message.startsWith('Admins only')) return { error: 'Only superadmins can do that.' };
    return { error: op === 'delete' ? 'Could not delete. Please try again.' : 'Could not save. Please try again.' };
}
