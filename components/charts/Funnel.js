import ChartCard from './ChartCard';
import { formatInt, pct } from '../../lib/format';

// Four steps, each a subset of the one above. One hue stepping from strong to light, so the order is
// visible without reading a label. The text sits above each bar, never inside it.
const MIX = [100, 84, 68, 54];

export default function Funnel({ funnel }) {
    const { steps, renderers, voters, builders } = funnel;
    const first = steps[0].count;

    return (
        <ChartCard
            id="funnel"
            title="From sign-in to being judged"
            sub="Where drivers drop out on the way from a Google login to a build that someone voted on."
            table={{
                columns: ['Step', 'Users', '% of previous', '% of all'],
                rows: steps.map((step) => [step.label, step.count, pct(step.pctOfPrev), pct(step.pctOfFirst)]),
            }}
        >
            <ol className="funnel">
                {steps.map((step, i) => (
                    <li className="funnel__step" key={step.key}>
                        <div className="funnel__line">
                            <span>{step.label}</span>
                            <b>{formatInt(step.count)}</b>
                        </div>
                        <span className="funnel__bar" style={{ '--w': `${first > 0 ? (step.count / first) * 100 : 0}%`, '--mix': `${MIX[i]}%` }} />
                        {i > 0 && (
                            <span className="funnel__drop">
                                {pct(step.pctOfPrev)} of the step above · {pct(step.pctOfFirst)} of everyone
                            </span>
                        )}
                    </li>
                ))}
            </ol>
            <p className="chart__note">
                Also: {formatInt(builders > 0 ? renderers : 0)} of {formatInt(builders)} builders rendered a build, and {formatInt(voters)} {voters === 1 ? 'user has' : 'users have'} cast votes.
            </p>
        </ChartCard>
    );
}
