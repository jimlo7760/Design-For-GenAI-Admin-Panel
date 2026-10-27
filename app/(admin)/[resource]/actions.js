'use server';

// Create, update and delete for every Week 7 section (lib/resources.js). Server Actions can be POSTed
// to directly, without ever loading a page, so every one starts with requireAdmin(), then looks the
// section up in the registry and refuses any operation it does not offer. The database refuses
// non-admins, and verbs that a table does not grant, too (supabase/week7.sql): this is the first
// lock, not the only one.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '../../../lib/auth';
import { isUuid } from '../../../lib/mods';
import { parseRecordForm, recordError } from '../../../lib/records';
import { resourceFor } from '../../../lib/resources';
import { createClient } from '../../../lib/supabase/server';

// Lists show names from other sections (a model's provider, an example's chain), so a change can show
// up on pages other than its own. Clearing the whole layout is simpler than tracking which.
const refresh = () => revalidatePath('/', 'layout');

// The section for this operation, or null when it does not exist or does not offer it.
function sectionFor(key, op) {
    const resource = resourceFor(key);
    return resource?.ops[op] ? resource : null;
}

// Creates a record. Returns { errors } (field by field) or { error }; on success it redirects to the
// new record, so it only ever returns when something is wrong.
export async function createRecord(key, formData) {
    await requireAdmin();
    const resource = sectionFor(key, 'create');
    if (!resource) return { error: 'That cannot be created here.' };

    const { errors, payload } = parseRecordForm(resource.fields, formData);
    if (errors) return { errors };

    const supabase = await createClient();
    const { data, error } = await supabase.from(resource.table).insert(payload).select('id').single();
    if (error) {
        console.error(`Could not create ${resource.noun}:`, error.message);
        return recordError(error, resource);
    }

    refresh();
    redirect(`/${resource.key}/${data.id}?created=1`);
}

export async function updateRecord(key, id, formData) {
    await requireAdmin();
    const resource = sectionFor(key, 'update');
    if (!resource) return { error: 'That cannot be changed here.' };
    if (!isUuid(id)) return { error: `That ${resource.noun} does not exist.` };

    const { errors, payload } = parseRecordForm(resource.fields, formData);
    if (errors) return { errors };

    const supabase = await createClient();
    // .select() hands back the changed rows, so "nothing changed" (the record is already gone, or a
    // rule refused it) is not mistaken for success.
    const { data, error } = await supabase.from(resource.table).update(payload).eq('id', id).select('id');
    if (error) {
        console.error(`Could not update ${resource.noun}:`, error.message);
        return recordError(error, resource);
    }
    if (!data || data.length === 0) return { error: `That ${resource.noun} no longer exists. It may have been deleted.` };

    refresh();
    redirect(`/${resource.key}/${id}?saved=1`);
}

// Returns { ok } or { error }.
export async function deleteRecord(key, id) {
    await requireAdmin();
    const resource = sectionFor(key, 'delete');
    if (!resource) return { error: 'That cannot be deleted here.' };
    if (!isUuid(id)) return { error: `That ${resource.noun} does not exist.` };

    const supabase = await createClient();
    const { data, error } = await supabase.from(resource.table).delete().eq('id', id).select('id');
    if (error) {
        console.error(`Could not delete ${resource.noun}:`, error.message);
        return recordError(error, resource, 'delete');
    }
    if (!data || data.length === 0) return { error: `Nothing was deleted. The ${resource.noun} may already be gone.` };

    refresh();
    return { ok: true };
}
