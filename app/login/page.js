import { redirect } from 'next/navigation';
import WheelMark from '../../components/WheelMark';
import { getCurrentUser } from '../../lib/auth';
import GoogleSignInButton from './GoogleSignInButton';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }) {
    // Already signed in: the home page decides whether you are an admin.
    if (await getCurrentUser()) redirect('/');

    const { error } = await searchParams;

    return (
        <main id="main" tabIndex={-1} className="main">
            <section className="gate" aria-labelledby="gate-title">
                <WheelMark className="gate__wheel" />
                <div className="container gate__inner">
                    <span className="plate">Pit wall</span>
                    <h1 id="gate-title">
                        Staff only. <span className="gate__accent">Badge in.</span>
                    </h1>
                    <p className="gate__lede">
                        The Mod Squad admin area. Sign in with the Google account you use for Mod Squad. Only accounts an owner has marked as superadmin get past this screen.
                    </p>
                    {error && (
                        <p role="alert" className="alert">
                            Sign-in didn&apos;t work. Please try again.
                        </p>
                    )}
                    <GoogleSignInButton />
                </div>
                <div className="stripes" aria-hidden="true" />
            </section>
        </main>
    );
}
