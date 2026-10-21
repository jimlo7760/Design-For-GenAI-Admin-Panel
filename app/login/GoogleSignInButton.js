'use client';

import { useState } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function GoogleSignInButton() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function signIn() {
        setLoading(true);
        setError('');

        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            // Must be exactly /auth/callback: no extra path or query parameters.
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });

        // On success the browser is already on its way to Google.
        if (error) {
            setError(error.message);
            setLoading(false);
        }
    }

    return (
        <div>
            <button type="button" className="btn btn--google btn--lg" onClick={signIn} disabled={loading}>
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.3-3.9 7.1-9.7 7.1-17.1z" />
                    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
                    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.3-8.7 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
                </svg>
                {loading ? 'Redirecting to Google…' : 'Continue with Google'}
            </button>
            {error && <p role="alert" className="alert" style={{ marginTop: '0.75rem' }}>{error}</p>}
        </div>
    );
}
