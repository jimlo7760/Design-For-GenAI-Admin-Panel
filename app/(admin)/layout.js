import Header from '../../components/Header';
import { requireAdmin } from '../../lib/auth';

// The frame around every admin page. Checking here keeps the shell from ever rendering for the
// wrong person, but a layout does NOT re-run when you move between pages, so it is not the lock:
// each page and data function calls requireAdmin() too.
export default async function AdminLayout({ children }) {
    const { user, profile } = await requireAdmin();

    return (
        <>
            <Header user={user} profile={profile} />
            <main id="main" tabIndex={-1} className="main">
                {children}
            </main>
            <footer className="site-footer">
                <div className="container container--wide site-footer__inner">
                    <span className="site-footer__name">Pit Wall</span>
                    <span>Mod Squad admin · Signed in as {user.email} · Everything you do here is checked by the database, not just by this page</span>
                </div>
            </footer>
        </>
    );
}
