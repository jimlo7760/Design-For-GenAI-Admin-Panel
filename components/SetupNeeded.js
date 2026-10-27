// Shown instead of a list when the Week 7 tables are not in the database yet.
export default function SetupNeeded() {
    return (
        <div className="notice" role="status">
            <strong>This section’s tables are not in the database yet.</strong>
            <ol style={{ margin: '0.6rem 0 0 1.2rem' }}>
                <li>Open <strong>SQL Editor</strong> in the Supabase dashboard.</li>
                <li>Paste the contents of <code>supabase/week7.sql</code> and run it (after <code>supabase/admin.sql</code>).</li>
                <li>Reload this page.</li>
            </ol>
        </div>
    );
}
