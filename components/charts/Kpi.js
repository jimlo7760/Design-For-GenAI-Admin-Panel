import { formatInt } from '../../lib/format';

// One gauge in the telemetry strip: a big number, what changed this week, and 14 days of bars with the
// last 7 in the accent colour (so "this week" stands out from "before").
export default function Kpi({ label, value, sub, last7, prev7, spark, unit = 'new' }) {
    const max = Math.max(1, ...(spark ?? []));
    const delta = last7 - prev7;
    const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : null;

    return (
        <div className="kpi">
            <span className="kpi__label">{label}</span>
            <span className="kpi__value">{value}</span>
            {sub && <span className="kpi__sub">{sub}</span>}
            {last7 !== undefined && (
                <>
                    <span className="kpi__sub">{formatInt(last7)} {unit} in the last 7 days</span>
                    <span className="kpi__sub">
                        {direction ? (
                            <>
                                <span className={`kpi__delta--${direction}`}>{direction === 'up' ? '▲' : '▼'} {formatInt(Math.abs(delta))} {direction === 'up' ? 'more' : 'fewer'}</span> than the week before
                            </>
                        ) : (
                            'the same as the week before'
                        )}
                    </span>
                </>
            )}
            {spark && (
                <span className="spark" role="img" aria-label={`${label}: ${spark.join(', ')} per day over the last ${spark.length} days`}>
                    {spark.map((count, i) => (
                        <i key={i} className={i >= spark.length - 7 ? 'is-recent' : undefined} style={{ height: `${Math.max(count > 0 ? 12 : 3, (count / max) * 100)}%` }} />
                    ))}
                </span>
            )}
        </div>
    );
}
