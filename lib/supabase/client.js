import { createBrowserClient } from '@supabase/ssr';

// For Client Components ('use client'). Keeps the session in cookies so the
// server can see who is logged in.
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
}
