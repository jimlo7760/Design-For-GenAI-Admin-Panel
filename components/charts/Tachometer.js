import { formatInt, pct } from '../../lib/format';

const CX = 120;
const CY = 118;
const R = 76;

// A point on the dial: v is 0 at the far left and 1 at the far right, r the distance from the hub.
const point = (v, r) => {
    const angle = Math.PI * (1 - v);
    return [CX + r * Math.cos(angle), CY - r * Math.sin(angle)];
};
const fix = (n) => n.toFixed(2);

// The hero figure: community approval (the share of all votes that were upvotes) as a tachometer.
// The needle and the filled arc show the value; the number is also written out in the middle, so the
// dial is never the only way to read it.
export default function Tachometer({ ratio, up, down }) {
    const known = ratio !== null && ratio !== undefined;
    const value = known ? Math.min(1, Math.max(0, ratio)) : 0;
    const [fx, fy] = point(value, R);
    const [nx, ny] = point(value, R - 10);
    const label = known
        ? `Community approval ${pct(ratio)}: ${formatInt(up)} upvotes and ${formatInt(down)} downvotes`
        : 'Community approval: no votes yet';

    return (
        <svg className="tach" viewBox="0 0 240 192" role="img" aria-label={label}>
            <path className="tach__track" d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} />
            {known && value > 0 && <path className="tach__fill" d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${fix(fx)} ${fix(fy)}`} />}

            {Array.from({ length: 11 }, (_, i) => {
                const major = i % 2 === 0;
                const [x1, y1] = point(i / 10, R + 9);
                const [x2, y2] = point(i / 10, R + (major ? 16 : 12));
                const [tx, ty] = point(i / 10, R + 26);
                return (
                    <g key={i}>
                        <line className={`tach__tick${major ? ' tach__tick--major' : ''}`} x1={fix(x1)} y1={fix(y1)} x2={fix(x2)} y2={fix(y2)} />
                        {major && <text className="tach__num" x={fix(tx)} y={fix(ty)}>{i * 10}</text>}
                    </g>
                );
            })}

            {known && <line className="tach__needle" x1={CX} y1={CY} x2={fix(nx)} y2={fix(ny)} />}
            <circle className="tach__hub" cx={CX} cy={CY} r="7" />

            <text className="tach__value" x={CX} y={CY + 50}>{known ? pct(ratio) : '–'}</text>
            <text className="tach__caption" x={CX} y={CY + 68}>of votes are upvotes</text>
        </svg>
    );
}
