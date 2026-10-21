import ChartCard from './ChartCard';

// The words people put in their vibes. Size is how many builds used the word; the tooltip adds the
// average score of those builds.
export default function WordCloud({ vibes }) {
    const { cloud, loved, unloved } = vibes;
    const max = Math.max(1, ...cloud.map((row) => row.count));
    const size = (count) => 0.95 + 1.35 * Math.sqrt(count / max);

    return (
        <ChartCard
            id="vibes"
            title="The vibe vocabulary"
            sub="The words people use when they describe a build. Bigger means more builds."
            table={{
                columns: ['Word', 'Builds', 'Average score'],
                rows: cloud.map((row) => [row.word, row.count, row.avgScore === null ? '–' : Number(row.avgScore.toFixed(2))]),
            }}
        >
            {cloud.length === 0 ? (
                <p className="muted">No vibes yet.</p>
            ) : (
                <div className="chips-cloud">
                    {cloud.map((row) => (
                        <span
                            key={row.word}
                            className="cloud-word"
                            style={{ fontSize: `${size(row.count).toFixed(2)}rem` }}
                            title={`${row.word}: ${row.count} build${row.count === 1 ? '' : 's'}${row.avgScore === null ? '' : `, average score ${row.avgScore.toFixed(1)}`}`}
                        >
                            {row.word}
                            <small>{row.count}</small>
                        </span>
                    ))}
                </div>
            )}
            {(loved.length > 0 || unloved.length > 0) && (
                <div className="chart__callout stack-sm">
                    {loved.length > 0 && (
                        <div>
                            <span className="up">▲ Vibes the squad loves</span>{' '}
                            {loved.map((row) => `${row.word} (${row.avgScore > 0 ? '+' : ''}${row.avgScore.toFixed(1)})`).join(', ')}
                        </div>
                    )}
                    {unloved.length > 0 && (
                        <div>
                            <span className="down">▼ Vibes that struggle</span>{' '}
                            {unloved.map((row) => `${row.word} (${row.avgScore.toFixed(1)})`).join(', ')}
                        </div>
                    )}
                    <p className="chart__note">Average score of builds using the word, for words used in at least 3 builds.</p>
                </div>
            )}
        </ChartCard>
    );
}
