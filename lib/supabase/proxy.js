import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// The only routes you can visit without logging in. Everything else, including pages added
// later, sends logged-out visitors to /login. This is a fast first redirect, not the lock:
// every page, data function and Server Action calls requireAdmin() (lib/auth.js) for itself,
// and the database refuses anyone who is not a superadmin.
const PUBLIC_PATHS = ['/login', '/auth', '/robots.txt'];

export async function updateSession(request) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    // Pass a refreshed session on to the page being rendered
                    // and back to the browser.
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refreshes the session if it's about to expire. Don't put code between
    // createServerClient and this call.
    const { data } = await supabase.auth.getClaims();
    const isSignedIn = Boolean(data?.claims);

    const { pathname } = request.nextUrl;
    const isPublic = PUBLIC_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`)
    );

    if (!isSignedIn && !isPublic) {
        const redirect = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
    }

    return response;
}
