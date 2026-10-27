import Link from 'next/link';
import UserCell from './UserCell';
import { ago, formatInt, pct } from '../lib/format';

// A long text cut to one line-ish for a list. The full text stays in the title attribute.
const clip = (text, max = 90) => {
    const flat = String(text).replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

const isImageUrl = (value) => typeof value === 'string' && /^https:\/\//i.test(value);

export const cellValue = (column, row, ctx) => (column.get ? column.get(row, ctx) : row[column.key]);

// One value in a list or on a detail page, drawn by the column's type (see lib/resources.js).
// `full` is the detail page: long text is shown whole, and images large.
export default function RecordCell({ column, row, resource, ctx = {}, full = false }) {
    const value = cellValue(column, row, ctx);
    const empty = value === null || value === undefined || value === '';
    const none = <span className="muted">–</span>;

    switch (column.type) {
        case 'title':
            return <Link className="cell-user__name" href={`/${resource.key}/${row.id}`}>{empty ? 'Untitled' : value}</Link>;

        case 'long':
            if (empty) return none;
            return full
                ? <pre className="code" style={{ whiteSpace: 'pre-wrap' }}>{value}</pre>
                : <span className="cell-long" title={value}>{clip(value)}</span>;

        case 'response':
            if (empty) return none;
            if (row.kind === 'image' && isImageUrl(value)) {
                return full
                    ? <img className="render-frame" src={value} alt="The image the model drew" />
                    : <img className="thumb" src={value} alt="The image the model drew" loading="lazy" />;
            }
            return full
                ? <pre className="code" style={{ whiteSpace: 'pre-wrap' }}>{value}</pre>
                : <span className="cell-long" title={value}>{clip(value)}</span>;

        case 'int':
            return Number.isFinite(value) ? formatInt(value) : none;

        case 'bool': {
            if (value === null || value === undefined) return none;
            const [on, off] = column.labels ?? ['Yes', 'No'];
            return <span className={value ? 'pill pill--accent' : 'pill'}>{value ? on : off}</span>;
        }

        case 'date':
            return empty ? none : <span className="nowrap" title={value}>{ago(value)}</span>;

        case 'pill':
            return empty ? none : <span className="pill">{value}</span>;

        case 'link': {
            if (empty) return none;
            const href = column.href?.(row, ctx);
            return href ? <Link href={href}>{value}</Link> : <span>{value}</span>;
        }

        case 'share':
            return (
                <span className="meter-cell">
                    <span className="meter" aria-hidden="true"><span className="meter__fill" style={{ '--w': `${Math.round((value || 0) * 100)}%` }} /></span>
                    <span className="num">{pct(value || 0)}</span>
                </span>
            );

        case 'user':
            return value?.id || value?.first_name ? <UserCell {...value} size={28} /> : none;

        default:
            return empty ? none : <span>{String(value)}</span>;
    }
}
