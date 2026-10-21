import { updateSession } from './lib/supabase/proxy';

// Next.js 16 calls this file "proxy" (it used to be "middleware").
export async function proxy(request) {
    return updateSession(request);
}

export const config = {
    // Everything except Next's own static files and images in /public. Pages, API routes and Server
    // Action posts all pass through.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
