'use server';

// Server Actions can be POSTed to directly, without ever loading a page, so every one starts with
// requireAdmin(). The database refuses non-admins too (supabase/admin.sql): this is the first lock,
// not the only one.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '../../../lib/auth';
import { createClient } from '../../../lib/supabase/server';
import { friendlyDbError, parseMediaForm } from '../../../lib/media-form';
import { isUuid } from '../../../lib/mods';
import { RENDER_BUCKET, isRenderPathFor, renderPathFromUrl } from '../../../lib/renders';

function refresh(id) {
    revalidatePath('/');
    revalidatePath('/media');
    revalidatePath('/users');
    revalidatePath('/votes');
    if (id) revalidatePath(`/media/${id}`);
}

// Creates a build for the chosen user. Returns { errors } (field by field) or { error }; on success
// it redirects to the new build, so it only ever returns when something is wrong.
export async function createMedia(formData) {
    await requireAdmin();
    const { errors, payload } = parseMediaForm(formData, { creating: true });
    if (errors) return { errors };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('admin_create_build', {
        p_user_id: payload.user_id,
        p_car_name: payload.car_name,
        p_vibe: payload.vibe,
        p_title: payload.title,
        p_tagline: payload.tagline,
        p_mods: payload.mods,
        p_cost: payload.est_cost_usd,
        p_model: payload.model,
        p_prompt: payload.prompt || null,
    });
    if (error) {
        console.error('Could not create build:', error.message);
        return { error: friendlyDbError(error) };
    }

    refresh();
    redirect(`/media/${data}?created=1`);
}

export async function updateMedia(formData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!isUuid(id)) return { error: 'That build does not exist.' };

    const { errors, payload } = parseMediaForm(formData);
    if (errors) return { errors };

    const supabase = await createClient();
    const { error } = await supabase.rpc('admin_update_build', {
        p_id: id,
        p_patch: {
            car_name: payload.car_name,
            vibe: payload.vibe,
            title: payload.title,
            tagline: payload.tagline,
            model: payload.model,
            mods: payload.mods,
            est_cost_usd: payload.est_cost_usd,
        },
    });
    if (error) {
        console.error('Could not update build:', error.message);
        return { error: friendlyDbError(error) };
    }

    refresh(id);
    redirect(`/media/${id}?saved=1`);
}

// Deletes a build (its votes go with it) and the render file it owned. Returns { ok } or { error }.
export async function deleteMedia(id) {
    await requireAdmin();
    if (!isUuid(id)) return { error: 'That build does not exist.' };
    const supabase = await createClient();

    const { data: build } = await supabase.from('builds').select('render_url').eq('id', id).maybeSingle();

    // .select() hands back the deleted rows, so "nothing was deleted" (a build that is already gone,
    // or a rule that refused) is not mistaken for success.
    const { data: deleted, error } = await supabase.from('builds').delete().eq('id', id).select('id');
    if (error) {
        console.error('Could not delete build:', error.message);
        return { error: friendlyDbError(error) };
    }
    if (!deleted || deleted.length === 0) return { error: 'Nothing was deleted. The build may already be gone.' };

    const path = renderPathFromUrl(build?.render_url);
    if (path) await supabase.storage.from(RENDER_BUCKET).remove([path]);

    refresh(id);
    return { ok: true };
}

// The browser has already uploaded the image straight to Storage (with the admin's own session, so
// the bucket's rules apply). This only points the build at it and tidies up the file it replaces.
export async function attachRender(buildId, path) {
    await requireAdmin();
    if (!isUuid(buildId) || !isRenderPathFor(path, buildId)) return { error: 'That upload is not valid.' };
    const supabase = await createClient();

    const { data: build } = await supabase.from('builds').select('render_url').eq('id', buildId).maybeSingle();
    if (!build) {
        await supabase.storage.from(RENDER_BUCKET).remove([path]);
        return { error: 'That build no longer exists.' };
    }

    const { data: { publicUrl } } = supabase.storage.from(RENDER_BUCKET).getPublicUrl(path);
    const { error } = await supabase.rpc('admin_update_build', {
        p_id: buildId,
        p_patch: { render_url: publicUrl, render_model: 'admin upload', rendered_at: new Date().toISOString() },
    });
    if (error) {
        console.error('Could not attach render:', error.message);
        await supabase.storage.from(RENDER_BUCKET).remove([path]); // don't leave an orphan file behind
        return { error: friendlyDbError(error) };
    }

    const previous = renderPathFromUrl(build.render_url);
    if (previous && previous !== path) await supabase.storage.from(RENDER_BUCKET).remove([previous]);

    refresh(buildId);
    return { ok: true };
}

export async function removeRender(buildId) {
    await requireAdmin();
    if (!isUuid(buildId)) return { error: 'That build does not exist.' };
    const supabase = await createClient();

    const { data: build } = await supabase.from('builds').select('render_url').eq('id', buildId).maybeSingle();
    if (!build?.render_url) return { error: 'This build has no render.' };

    const { error } = await supabase.rpc('admin_update_build', {
        p_id: buildId,
        p_patch: { render_url: null, render_model: null, rendered_at: null },
    });
    if (error) {
        console.error('Could not remove render:', error.message);
        return { error: friendlyDbError(error) };
    }

    const path = renderPathFromUrl(build.render_url);
    if (path) await supabase.storage.from(RENDER_BUCKET).remove([path]);

    refresh(buildId);
    return { ok: true };
}
