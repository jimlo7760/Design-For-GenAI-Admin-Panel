import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

// Google -> Supabase -> here, with a one-time `code` in the URL. Swapping it for
// a session stores the login cookies.
export async function GET(request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        // Happens when the user cancels on Google's screen, or on a bad setup.
        console.error('Auth callback had no code:', searchParams.get('error_description') ?? searchParams.get('error'));
        return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        console.error('Could not exchange the auth code for a session:', error.message);
        return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
    }

    // Signed in is not the same as allowed in: the pages check the admin flag, and send everyone
    // else to /denied.
    return NextResponse.redirect(`${origin}/`);
}
