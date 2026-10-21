// A ranked list of horizontal bars: label, thin bar, value. One series, one colour. The value is
// written at the end of the bar, so nothing has to be read off an axis.
export default function BarList({ items, tone }) {
    const max = Math.max(1, ...items.map((item) => item.value));
    return (
        <ul className="bars">
            {items.map((item) => (
                <li className="bar-row" key={item.key ?? item.label} title={item.title}>
                    <span className="bar-row__label">
                        {item.label}
                        {item.sub && <small>{item.sub}</small>}
                    </span>
                    <span className="bar-row__track" aria-hidden="true">
                        <span className={`bar-row__fill${tone ? ` bar-row__fill--${tone}` : ''}`} style={{ '--w': `${(item.value / max) * 100}%` }} />
                    </span>
                    <span className="bar-row__value">
                        {item.display ?? item.value}
                        {item.extra && <span className="bar-row__extra">{item.extra}</span>}
                    </span>
                </li>
            ))}
        </ul>
    );
}
