import ChartTable from './ChartTable';

// The frame every chart sits in: a title, one line saying what to look for, the chart itself, and a
// table twin underneath (the same numbers as text, for screen readers and anyone who wants them).
export default function ChartCard({ id, title, sub, children, table, className = '' }) {
    return (
        <section className={`card chart ${className}`.trim()} aria-labelledby={`${id}-title`}>
            <div className="chart__head">
                <h2 id={`${id}-title`}>{title}</h2>
                {sub && <p className="chart__sub">{sub}</p>}
            </div>
            {children}
            {table && <ChartTable {...table} />}
        </section>
    );
}
