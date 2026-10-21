import Link from 'next/link';
import { formatInt } from '../lib/format';
import { withParams } from '../lib/query';

// "Showing 26–50 of 130" with Previous and Next links that keep the current search and filters.
export default function Pager({ path, params, page, pageSize, total }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);

    return (
        <nav className="pager" aria-label="Pages">
            <span>
                {total === 0 ? 'Nothing to show' : `Showing ${formatInt(from)}–${formatInt(to)} of ${formatInt(total)}`}
                {pages > 1 && ` · page ${page} of ${pages}`}
            </span>
            <span className="row">
                {page > 1 ? (
                    <Link className="btn btn--sm" href={withParams(path, params, { page: page - 1 })}>← Previous</Link>
                ) : (
                    <span className="btn btn--sm" aria-disabled="true">← Previous</span>
                )}
                {page < pages ? (
                    <Link className="btn btn--sm" href={withParams(path, params, { page: page + 1 })}>Next →</Link>
                ) : (
                    <span className="btn btn--sm" aria-disabled="true">Next →</span>
                )}
            </span>
        </nav>
    );
}
