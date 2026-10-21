import Link from 'next/link';
import ChartCard from './ChartCard';
import Avatar from '../Avatar';
import BarList from './BarList';
import { formatInt, pct, usd, usdCompact } from '../../lib/format';

// The most-modded makes: how many builds each has, and beside each its average score and price.
export function Brands({ brands, models }) {
    return (
        <ChartCard
            id="brands"
            title="Most-modded makes"
            sub="Which cars the squad dreams about, with how well those builds score and what they cost."
            table={{
                columns: ['Make', 'Builds', 'Share', 'Average score', 'Average cost'],
                rows: brands.top.map((row) => [
                    row.brand,
                    row.builds,
                    pct(row.share),
                    row.avgScore === null ? '–' : Number(row.avgScore.toFixed(2)),
                    usd(row.avgCost),
                ]),
            }}
        >
            {brands.top.length === 0 ? (
                <p className="muted">No builds yet.</p>
            ) : (
                <BarList
                    items={brands.top.map((row) => ({
                        key: row.brand,
                        label: row.brand,
                        sub: `avg score ${row.avgScore === null ? '–' : row.avgScore.toFixed(1)} · avg ${usdCompact(row.avgCost)}`,
                        value: row.builds,
                        display: row.builds,
                        title: `${row.brand}: ${row.builds} builds (${pct(row.share)})`,
                    }))}
                />
            )}
            {brands.otherBrands > 0 && <p className="chart__note">…and {brands.otherBrands} other makes with {brands.otherBuilds} builds between them.</p>}
            {models.length > 0 && (
                <p className="chart__note">
                    Most-built models: {models.slice(0, 4).map((model) => `${model.name} (${model.count})`).join(', ')}.
                </p>
            )}
        </ChartCard>
    );
}

// What the AI recommends and what it costs: spend per part category.
export function Categories({ categories }) {
    return (
        <ChartCard
            id="categories"
            title="Where the money goes"
            sub="Total spend on each kind of part across every build, with how many builds include it."
            table={{
                columns: ['Category', 'Spend', 'Builds with it', '% of builds'],
                rows: categories.top.map((row) => [row.category, usd(row.spend), row.builds, pct(row.shareOfBuilds)]),
            }}
        >
            {categories.top.length === 0 ? (
                <p className="muted">No parts yet.</p>
            ) : (
                <BarList
                    tone="c2"
                    items={categories.top.map((row) => ({
                        key: row.category,
                        label: row.category,
                        sub: `in ${pct(row.shareOfBuilds)} of builds`,
                        value: row.spend,
                        display: usdCompact(row.spend),
                        title: `${row.category}: ${usd(row.spend)} across ${row.parts} parts in ${row.builds} builds`,
                    }))}
                />
            )}
            {categories.otherKinds > 0 && (
                <p className="chart__note">…and {categories.otherKinds} smaller categories worth {usdCompact(categories.otherSpend)} in total.</p>
            )}
        </ChartCard>
    );
}

export function Wanted({ wanted }) {
    return (
        <ChartCard
            id="wanted"
            title="Most wanted parts"
            sub="What owners search for when they want to add a part. A shopping list for the next feature."
            table={{ columns: ['Search', 'Times'], rows: wanted.map((row) => [row.query, row.count]) }}
        >
            {wanted.length === 0 ? (
                <p className="muted">Nobody has searched for a part yet.</p>
            ) : (
                <BarList items={wanted.map((row) => ({ key: row.query, label: row.query, value: row.count, display: row.count }))} />
            )}
        </ChartCard>
    );
}

export function Creators({ creators }) {
    return (
        <ChartCard
            id="creators"
            title="Hall of fame"
            sub="The five drivers whose builds have earned the most net votes."
            table={{ columns: ['Driver', 'Builds', 'Score', 'Approval'], rows: creators.map((c) => [c.name, c.builds, c.score, pct(c.approval)]) }}
        >
            {creators.length === 0 ? (
                <p className="muted">No builds yet.</p>
            ) : (
                <ol className="rank">
                    {creators.map((creator) => (
                        <li className="rank__item" key={creator.id}>
                            <div className="row" style={{ gap: '0.7rem', flexWrap: 'nowrap' }}>
                                <Avatar url={creator.avatar_url} name={creator.name} size={36} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <Link className="rank__title" href={`/users/${creator.id}`}>{creator.name}</Link>
                                    <div className="rank__sub">
                                        {formatInt(creator.builds)} build{creator.builds === 1 ? '' : 's'} · {pct(creator.approval)} approval
                                    </div>
                                </div>
                                <b className={`num ${creator.score > 0 ? 'up' : creator.score < 0 ? 'down' : ''}`} style={{ fontFamily: 'var(--font-head)', fontSize: '1.4rem' }}>
                                    {creator.score > 0 ? '▲ +' : creator.score < 0 ? '▼ ' : ''}{creator.score}
                                </b>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </ChartCard>
    );
}
