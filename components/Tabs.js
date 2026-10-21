import Link from 'next/link';
import { withParams } from '../lib/query';

// A row of links that each set one URL parameter (a filter or a sort), keeping the rest.
export default function Tabs({ label, path, params, name, options, current, fallback }) {
    return (
        <div className="tabs" role="group" aria-label={label}>
            {Object.entries(options).map(([value, text]) => (
                <Link
                    key={value}
                    className="tab"
                    href={withParams(path, params, { [name]: value === fallback ? '' : value })}
                    aria-current={current === value ? 'true' : undefined}
                >
                    {typeof text === 'string' ? text : text.label}
                </Link>
            ))}
        </div>
    );
}
