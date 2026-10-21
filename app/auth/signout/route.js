import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function POST(request) {
    // A form on another website could otherwise sign an admin out. Browsers always send Origin on a
    // cross-site POST, so a mismatch means it did not come from our own button.
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const supabase = await createClient();
    await supabase.auth.signOut();

    // 303 makes the browser follow the redirect with a GET.
    return NextResponse.redirect(new URL('/login', request.url), 303);
}
