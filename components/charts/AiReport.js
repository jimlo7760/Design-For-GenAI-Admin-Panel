import ChartCard from './ChartCard';
import { formatInt, pct, usd } from '../../lib/format';

const SWATCH = ['', 'swatch--c2', 'swatch--c3'];
const FILL = ['', 'c2', 'c3'];

// One stacked bar of who wrote the builds, with every segment named in the legend (and directly
// labelled with its share), so the colours are never the only thing telling them apart.
function Mix({ title, counts }) {
    const total = counts.top.reduce((sum, row) => sum + row.count, 0) + counts.other;
    if (total === 0) return null;
    return (
        <div className="stack-sm">
            <span className="label">{title}</span>
            <div className="stacked" role="img" aria-label={`${title}: ${counts.top.map((row) => `${row.name} ${pct(row.count / total)}`).join(', ')}`}>
                {counts.top.map((row, i) => (
                    <span key={row.name} className={FILL[i]} style={{ flex: row.count }} title={`${row.name}: ${row.count}`} />
                ))}
                {counts.other > 0 && <span className="other" style={{ flex: counts.other }} title={`Other: ${counts.other}`} />}
            </div>
            <div className="legend">
                {counts.top.map((row, i) => (
                    <span className="legend__item" key={row.name}>
                        <i className={`swatch ${SWATCH[i]}`} />
                        {row.name} <b>{pct(row.count / total)}</b>
                    </span>
                ))}
                {counts.other > 0 && (
                    <span className="legend__item">
                        <i className="swatch swatch--other" />
                        {counts.otherKinds} other{counts.otherKinds === 1 ? '' : 's'} <b>{pct(counts.other / total)}</b>
                    </span>
                )}
            </div>
        </div>
    );
}

// The AI's report card: how often owners rewrite what it wrote, how many builds got an image, what a
// typical build looks like, and which models did the work.
export default function AiReport({ ai }) {
    return (
        <ChartCard
            id="ai"
            title="The AI's report card"
            sub="How the machine is doing, judged by what people do with its work."
            table={{
                columns: ['Measure', 'Value'],
                rows: [
                    ['Owners rewrote the AI\'s parts list', pct(ai.editedRate)],
                    ['Builds with an AI render', pct(ai.renderRate)],
                    ['Builds that start from the owner\'s own photo', pct(ai.withOwnPhotoRate)],
                    ['Parts per build', ai.avgParts === null ? '–' : ai.avgParts.toFixed(1)],
                    ['Average estimated cost', usd(ai.avgCost)],
                    ...ai.models.top.map((row) => [`Text model: ${row.name}`, formatInt(row.count)]),
                    ...ai.renderModels.top.map((row) => [`Image model: ${row.name}`, formatInt(row.count)]),
                ],
            }}
        >
            <div className="tiles">
                <div className="tile">
                    <div className="tile__label">Parts list rewritten</div>
                    <div className="tile__value">{pct(ai.editedRate)}</div>
                    <div className="tile__sub">of builds had their parts changed by the owner</div>
                </div>
                <div className="tile">
                    <div className="tile__label">Got a render</div>
                    <div className="tile__value">{pct(ai.renderRate)}</div>
                    <div className="tile__sub">of builds have an AI image</div>
                </div>
                <div className="tile">
                    <div className="tile__label">Parts per build</div>
                    <div className="tile__value">{ai.avgParts === null ? '–' : ai.avgParts.toFixed(1)}</div>
                    <div className="tile__sub">on average</div>
                </div>
                <div className="tile">
                    <div className="tile__label">Typical price tag</div>
                    <div className="tile__value">{usd(ai.avgCost)}</div>
                    <div className="tile__sub">average estimated cost</div>
                </div>
            </div>
            <Mix title="Which text model wrote the builds" counts={ai.models} />
            <Mix title="Which image model drew the renders" counts={ai.renderModels} />
        </ChartCard>
    );
}
