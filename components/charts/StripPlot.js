import ChartCard from './ChartCard';
import { swarm } from '../../lib/scales';
import { pct } from '../../lib/format';

const W = 560;
const M = { left: 14, right: 14, top: 22, bottom: 34 };
const PLOT_W = W - M.left - M.right;

// Judging temperament: one dot per voter (three or more votes), placed by the share of their votes
// that were upvotes. Bigger dots cast more votes. The line is the squad's overall average, so you can
// see at a glance who judges generously and who is a tough crowd.
export default function StripPlot({ voters }) {
    const { judges, average, generous, toughest, busiest, everyone, minVotes } = voters;

    let body;
    if (judges.length === 0) {
        body = <p className="muted">Nobody has cast {minVotes} votes yet, so there is no one to compare. ({everyone} {everyone === 1 ? 'user has' : 'users have'} voted at all.)</p>;
    } else {
        const radius = (votes) => Math.min(11, 4 + Math.sqrt(votes) * 1.1);
        const placed = swarm(judges.map((judge) => ({ ...judge, x: M.left + judge.upRate * PLOT_W, r: radius(judge.votes) })));
        const spread = Math.max(14, ...placed.map((dot) => Math.abs(dot.y) + dot.r));
        const cy = M.top + spread;
        const H = cy + spread + M.bottom;
        const special = new Set([generous?.id, toughest?.id]);

        body = (
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Each of ${judges.length} voters by share of upvotes. Average ${pct(average)}.`}>
                <line className="axisline" x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} />
                {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
                    <g key={tick}>
                        <line className="gridline" x1={M.left + tick * PLOT_W} x2={M.left + tick * PLOT_W} y1={M.top - 6} y2={H - M.bottom} />
                        <text className="tick-label" x={M.left + tick * PLOT_W} y={H - M.bottom + 16} textAnchor={tick === 0 ? 'start' : tick === 1 ? 'end' : 'middle'}>{Math.round(tick * 100)}%</text>
                    </g>
                ))}
                <text className="tick-label" x={M.left} y={H - 4}>← tough crowd</text>
                <text className="tick-label" x={W - M.right} y={H - 4} textAnchor="end">generous →</text>
                {placed.map((dot) => (
                    <g key={dot.id}>
                        <title>{`${dot.name}: ${pct(dot.upRate)} upvotes over ${dot.votes} votes`}</title>
                        <circle className={special.has(dot.id) ? 'dot dot--named' : 'dot'} cx={dot.x} cy={cy + dot.y} r={dot.r} />
                    </g>
                ))}
                {average !== null && (
                    <g>
                        <line className="strip__ref" x1={M.left + average * PLOT_W} x2={M.left + average * PLOT_W} y1={M.top - 6} y2={H - M.bottom} />
                        <text className="strip__label" x={M.left + average * PLOT_W} y={M.top - 10} textAnchor={average > 0.8 ? 'end' : 'middle'}>squad average {pct(average)}</text>
                    </g>
                )}
            </svg>
        );
    }

    return (
        <ChartCard
            id="judges"
            title="Who judges how?"
            sub={`Every voter with at least ${minVotes} votes. Bigger dots voted more often.`}
            table={{
                columns: ['Voter', 'Votes', 'Upvote share'],
                rows: [...judges].sort((a, b) => b.upRate - a.upRate || b.votes - a.votes).map((judge) => [judge.name, judge.votes, pct(judge.upRate)]),
            }}
        >
            <div className="chart-split">
                <div>{body}</div>
                {judges.length >= 2 && generous && toughest && (
                    <div className="chart-split__side">
                        <ul className="chart__callout">
                            <li>Most generous: <strong>{generous.name}</strong><br /><span className="muted">{pct(generous.upRate)} of {generous.votes} votes were upvotes</span></li>
                            <li>Toughest: <strong>{toughest.name}</strong><br /><span className="muted">{pct(toughest.upRate)} of {toughest.votes} votes were upvotes</span></li>
                            {busiest && <li>Most votes cast: <strong>{busiest.name}</strong><br /><span className="muted">{busiest.votes} votes</span></li>}
                        </ul>
                        <p className="chart__note">The two ringed dots are the most generous and the toughest voters.</p>
                    </div>
                )}
            </div>
        </ChartCard>
    );
}
