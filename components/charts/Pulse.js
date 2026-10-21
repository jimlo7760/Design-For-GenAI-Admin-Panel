import ChartCard from './ChartCard';
import { formatInt } from '../../lib/format';

const W = 320;
const TOP = 16;
const PLOT = 66;
const H = TOP + PLOT + 18;
const GAP = 2;

// A column with its two top corners rounded and a square base, so it grows from the baseline.
function columnPath(x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h);
    return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function Series({ title, noun, days, field }) {
    const n = days.length;
    const width = (W - GAP * (n - 1)) / n;
    const values = days.map((day) => day[field]);
    const max = Math.max(1, ...values);
    const total = values.reduce((a, b) => a + b, 0);

    return (
        <div>
            <div className="pulse__head">
                <span className="pulse__title">{title}</span>
                <span className="pulse__total">{formatInt(total)}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} per day for the last ${n} days: ${total} in total, up to ${max} in a day`}>
                <line className="gridline" x1="0" x2={W} y1={TOP} y2={TOP} />
                <text className="tick-label" x="0" y={TOP - 5}>{max}</text>
                <line className="axisline" x1="0" x2={W} y1={TOP + PLOT} y2={TOP + PLOT} />
                {days.map((day, i) => {
                    const x = i * (width + GAP);
                    const h = values[i] === 0 ? 0 : Math.max(2, (values[i] / max) * PLOT);
                    return (
                        <g key={day.date}>
                            {h > 0 && <path d={columnPath(x, TOP + PLOT - h, width, h, 3)} className={i >= n - 7 ? 'mark-1' : 'mark-1 mark--old'} />}
                            <rect x={x - GAP / 2} y={TOP} width={width + GAP} height={PLOT} fill="transparent">
                                <title>{`${day.label}: ${values[i]} ${noun}${values[i] === 1 ? '' : 's'}`}</title>
                            </rect>
                        </g>
                    );
                })}
                <text className="tick-label" x="0" y={H - 3}>{days[0].label}</text>
                <text className="tick-label" x={W} y={H - 3} textAnchor="end">{days[n - 1].label}</text>
            </svg>
        </div>
    );
}

export default function Pulse({ days }) {
    return (
        <ChartCard
            id="pulse"
            title="The last 30 days"
            sub="Builds made, votes cast and drivers joining, day by day. The bold orange bars are this week."
            table={{
                columns: ['Day', 'Builds', 'Votes', 'New users'],
                rows: [...days].reverse().map((day) => [day.label, day.builds, day.votes, day.users]),
            }}
        >
            <div className="pulse">
                <Series title="Builds" noun="build" days={days} field="builds" />
                <Series title="Votes" noun="vote" days={days} field="votes" />
                <Series title="New drivers" noun="new user" days={days} field="users" />
            </div>
        </ChartCard>
    );
}
