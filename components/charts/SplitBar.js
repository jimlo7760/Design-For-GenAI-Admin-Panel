// Up-votes and down-votes side by side. Green and red are never the only signal: each side has a
// triangle and its count written out.
export default function SplitBar({ up, down }) {
    const total = up + down;
    return (
        <div className="split">
            <div className={`split__bar${down === 0 ? ' split__bar--only-up' : up === 0 ? ' split__bar--only-down' : ''}`} aria-hidden="true">
                {up > 0 && <span className="split__up" style={{ flex: up }} />}
                {down > 0 && <span className="split__down" style={{ flex: down }} />}
            </div>
            <div className="split__nums">
                <span className="up">▲ {up}</span>
                <span className="down">▼ {down}</span>
                <span className="muted">{total} vote{total === 1 ? '' : 's'}</span>
            </div>
        </div>
    );
}
