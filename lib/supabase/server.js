import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// For Server Components, Server Actions and Route Handlers. Create a new client per request.
// It runs as the signed-in person (their cookie, the public anon key), so the database's own
// rules apply to every query: see supabase/admin.sql.
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Server Components can't write cookies. That's fine:
                        // proxy.js refreshes the session on every request.
                    }
                },
            },
        }
    );
}
