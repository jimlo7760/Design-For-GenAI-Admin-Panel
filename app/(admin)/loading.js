// Shown instantly while a page's data loads, so navigation never feels frozen.
export default function Loading() {
    return (
        <div className="page" role="status" aria-label="Loading">
            <div className="container container--wide stack">
                <div className="skeleton" style={{ height: 44, width: '40%' }} />
                <div className="skeleton" style={{ height: 150 }} />
                <div className="skeleton" style={{ height: 320 }} />
            </div>
        </div>
    );
}
