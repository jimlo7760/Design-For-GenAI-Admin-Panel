import ChartCard from './ChartCard';
import { logTicks, niceTicks } from '../../lib/scales';
import { compact, usd } from '../../lib/format';

const W = 560;
const H = 300;
const M = { top: 12, right: 14, bottom: 42, left: 44 };

// Does spending more earn more votes? One dot per voted-on build: estimated cost across (log scale,
// because costs span orders of magnitude) and net score up. The rank correlation is written in words.
export default function Scatter({ data }) {
    const { points, rho, n, verdict } = data;

    let body;
    if (n === 0) {
        body = <p className="muted">No build with a price has been voted on yet.</p>;
    } else {
        const xTicks = logTicks(Math.min(...points.map((p) => p.cost)), Math.max(...points.map((p) => p.cost)));
        const xMin = xTicks[0];
        const xMax = xTicks[xTicks.length - 1];
        const scores = points.map((p) => p.score);
        const yTicks = niceTicks(Math.min(0, ...scores), Math.max(0, ...scores), 5);
        const yMin = yTicks[0];
        const yMax = yTicks[yTicks.length - 1];

        const x = (cost) => M.left + ((Math.log10(cost) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin))) * (W - M.left - M.right);
        const y = (score) => H - M.bottom - ((score - yMin) / (yMax - yMin)) * (H - M.top - M.bottom);

        body = (
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Scatter of ${n} builds: estimated cost against net score. ${verdict ?? ''}`}>
                {yTicks.map((tick) => (
                    <g key={`y${tick}`}>
                        <line className={tick === 0 ? 'axisline' : 'gridline'} x1={M.left} x2={W - M.right} y1={y(tick)} y2={y(tick)} />
                        <text className="tick-label" x={M.left - 8} y={y(tick) + 4} textAnchor="end">{tick}</text>
                    </g>
                ))}
                {xTicks.map((tick) => (
                    <g key={`x${tick}`}>
                        <line className="gridline" x1={x(tick)} x2={x(tick)} y1={M.top} y2={H - M.bottom} />
                        <text className="tick-label" x={x(tick)} y={H - M.bottom + 16} textAnchor="middle">${compact(tick)}</text>
                    </g>
                ))}
                <text className="tick-label" x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle">Estimated cost (each gridline is 10× the last)</text>
                <text className="tick-label" transform={`translate(12 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle">Net score (upvotes − downvotes)</text>
                {points.map((point) => (
                    <g key={point.id}>
                        <title>{`${point.title}: ${usd(point.cost)}, score ${point.score}`}</title>
                        <circle className="dot" cx={x(point.cost)} cy={y(point.score)} r="5" />
                        <circle className="dot--hit" cx={x(point.cost)} cy={y(point.score)} r="12" />
                    </g>
                ))}
            </svg>
        );
    }

    return (
        <ChartCard
            id="scatter"
            title="Does money buy love?"
            sub="Every dot is a build the squad has voted on. If dearer builds won more votes, the dots would climb to the right."
            table={{
                columns: ['Build', 'Estimated cost', 'Net score'],
                rows: [...points].sort((a, b) => b.cost - a.cost).map((p) => [p.title, usd(p.cost), p.score]),
            }}
        >
            <div className="chart-split">
                <div>{body}</div>
                <div className="chart-split__side">
                    {rho === null || rho === undefined ? (
                        <p className="muted">
                            {n < 8 ? `Needs at least 8 voted-on builds for a verdict (there ${n === 1 ? 'is' : 'are'} ${n}).` : 'No verdict: the scores or the prices are all identical.'}
                        </p>
                    ) : (
                        <>
                            <div>
                                <div className="big-stat">ρ = {rho.toFixed(2)}</div>
                                <p className="chart__callout" style={{ marginTop: '0.5rem' }}>{verdict}</p>
                            </div>
                            <p className="chart__note">
                                Spearman rank correlation across {n} builds. It runs from −1 to +1, and near 0 means what a build costs tells you nothing about how the squad will vote. Ranks, not dollars, so one $90,000 build cannot skew it.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </ChartCard>
    );
}
