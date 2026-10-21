import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

// cache() means the layout and the page share one lookup per request. (Server Actions are not part
// of a render, so there every call runs for real, which is what we want.)
export const getCurrentUser = cache(async () => {
    const supabase = await createClient();
    // getUser() asks Supabase Auth to verify the session, so a deleted or
    // signed-out user is never treated as logged in.
    const { data: { user } } = await supabase.auth.getUser();
    return user;
});

// Who is asking, and are they an admin? Always resolves to one of:
//   signed-out    no valid session
//   admin         signed in and profiles.is_superadmin is true
//   not-admin     signed in, flag is false (or there is no profile row)
//   setup-needed  the is_superadmin column does not exist: supabase/admin.sql has not been run
//   error         the lookup itself failed; we cannot tell, so we do not let them in
// Only 'admin' lets anything through. The flag cannot be written through the API (a trigger in
// supabase/admin.sql refuses), so a signed-in user cannot grant it to themselves.
export const getAdmin = cache(async () => {
    const user = await getCurrentUser();
    if (!user) return { status: 'signed-out' };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url, is_superadmin')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        // 42703 = undefined column.
        if (error.code === '42703' || error.message?.includes('is_superadmin')) return { status: 'setup-needed', user };
        console.error('Could not check admin access:', error.message);
        return { status: 'error', user };
    }
    if (data?.is_superadmin !== true) return { status: 'not-admin', user, profile: data };
    return { status: 'admin', user, profile: data };
});

// The first line of every page, data function and Server Action in the admin area. A layout is not
// enough on its own: layouts do not re-run when you move between pages, and Server Actions can be
// POSTed to directly. Redirects (and so never returns) unless the caller is an admin.
export async function requireAdmin() {
    const admin = await getAdmin();
    if (admin.status === 'signed-out') redirect('/login');
    if (admin.status !== 'admin') redirect('/denied');
    return admin;
}

export function fullName(profile) {
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
}

// What to call someone in the UI: their name, else the front of their email, else a short id.
export function displayName({ first_name, last_name, email, id } = {}) {
    return fullName({ first_name, last_name }) || email?.split('@')[0] || (id ? `User ${id.slice(0, 6)}` : 'Unknown');
}
