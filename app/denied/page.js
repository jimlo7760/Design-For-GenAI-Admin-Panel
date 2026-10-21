import { redirect } from 'next/navigation';
import WheelMark from '../../components/WheelMark';
import { getAdmin } from '../../lib/auth';

export const metadata = { title: 'No access' };

// Where signed-in people who are not (yet) admins land.
export default async function DeniedPage() {
    const admin = await getAdmin();
    if (admin.status === 'signed-out') redirect('/login');
    if (admin.status === 'admin') redirect('/');

    const email = admin.user.email ?? '';
    // Shown back to the signed-in person so they can copy it; it only works for whoever owns the
    // Supabase project.
    const sql = `update public.profiles set is_superadmin = true\n where id = (select id from auth.users where email = '${email.replaceAll("'", "''")}');`;

    return (
        <main id="main" tabIndex={-1} className="main">
            <section className="gate" aria-labelledby="denied-title">
                <WheelMark className="gate__wheel" />
                <div className="container gate__inner">
                    <span className="plate">No access</span>

                    {admin.status === 'setup-needed' ? (
                        <>
                            <h1 id="denied-title">The database isn&apos;t ready.</h1>
                            <p className="gate__lede">
                                The <code>is_superadmin</code> column doesn&apos;t exist yet. In the Supabase dashboard, open <strong>SQL Editor</strong> and run <code>supabase/admin.sql</code> from this repository. Then reload this page.
                            </p>
                        </>
                    ) : admin.status === 'error' ? (
                        <>
                            <h1 id="denied-title">Couldn&apos;t check your access.</h1>
                            <p className="gate__lede">
                                Something went wrong while looking you up, so you were not let in. Reload the page to try again.
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 id="denied-title">You&apos;re signed in, but not on the list.</h1>
                            <p className="gate__lede">
                                <strong>{email}</strong> isn&apos;t a superadmin. Ask the owner of the project to flip your <code>is_superadmin</code> flag.
                            </p>
                            <details className="gate__help">
                                <summary>I own this project and I&apos;m locked out</summary>
                                <p>
                                    The flag can&apos;t be set from this app on purpose, because anyone could then grant it to themselves. As the project owner you have a tool nobody else has: the Supabase SQL editor runs as the database owner. Open it, paste this, press Run, then reload:
                                </p>
                                <pre className="code">{sql}</pre>
                            </details>
                        </>
                    )}

                    <form action="/auth/signout" method="post">
                        <button type="submit" className="btn btn--lg">Sign out</button>
                    </form>
                </div>
                <div className="stripes" aria-hidden="true" />
            </section>
        </main>
    );
}
