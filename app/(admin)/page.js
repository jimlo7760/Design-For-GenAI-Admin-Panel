import Tachometer from '../../components/charts/Tachometer';
import Kpi from '../../components/charts/Kpi';
import Pulse from '../../components/charts/Pulse';
import Funnel from '../../components/charts/Funnel';
import Heatmap from '../../components/charts/Heatmap';
import Scatter from '../../components/charts/Scatter';
import StripPlot from '../../components/charts/StripPlot';
import WordCloud from '../../components/charts/WordCloud';
import AiReport from '../../components/charts/AiReport';
import ChartCard from '../../components/charts/ChartCard';
import RankedBuilds from '../../components/charts/RankedBuilds';
import { Brands, Categories, Creators, Wanted } from '../../components/charts/Leaderboards';
import { getDashboard } from '../../lib/admin-data';
import { requireAdmin } from '../../lib/auth';
import { dateTime, formatInt, pct, usdCompact } from '../../lib/format';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
    await requireAdmin();
    const { stats, meta } = await getDashboard();
    const { totals, approval, windows, sparks, ai } = stats;

    return (
        <div className="page">
            <div className="container container--wide dash">
                <header className="page-head">
                    <div>
                        <h1>Pit wall</h1>
                        <p>Live telemetry from the Mod Squad garage: who is building, what the AI is making, and how the squad is judging it.</p>
                    </div>
                    <p className="freshness">
                        Updated {dateTime(stats.generatedAt, meta.timeZone)}
                        <br />
                        Read {formatInt(meta.builds)} builds, {formatInt(meta.votes)} votes, {formatInt(meta.users)} users
                    </p>
                </header>

                {meta.truncated && (
                    <p className="notice" role="note">
                        There is more data than the dashboard reads in one go (20,000 rows per table), so the newest or lowest-numbered rows are shown and the totals are a floor, not the full count.
                    </p>
                )}

                <section className="kpi-strip" aria-label="Key numbers">
                    <Tachometer ratio={approval.rate} up={approval.up} down={approval.down} />
                    <div className="kpis">
                        <Kpi label="Drivers" value={formatInt(totals.users)} unit="joined" {...windows.users} spark={sparks.users} />
                        <Kpi label="Builds" value={formatInt(totals.builds)} unit="made" {...windows.builds} spark={sparks.builds} />
                        <Kpi label="Votes" value={formatInt(totals.votes)} unit="cast" {...windows.votes} spark={sparks.votes} />
                        <Kpi label="Renders" value={formatInt(totals.renders)} sub={`${pct(ai.renderRate)} of builds have one`} />
                        <Kpi label="Dream spend" value={usdCompact(totals.spend)} sub="estimated across every build" />
                        <Kpi label="Median build" value={usdCompact(totals.medianCost)} sub="the typical price tag" />
                    </div>
                </section>

                <Pulse days={stats.pulse.days} />

                <div className="dash-grid dash-grid--2">
                    <Funnel funnel={stats.funnel} />
                    <Heatmap heatmap={stats.heatmap} />
                </div>

                <div className="dash-grid dash-grid--2">
                    <Brands brands={stats.brands} models={stats.models} />
                    <Categories categories={stats.categories} />
                </div>

                <Scatter data={stats.costVsScore} />

                <div className="dash-grid dash-grid--2">
                    <ChartCard
                        id="favorites"
                        title="Crowd favorites"
                        sub="The builds with the highest net score."
                        table={{ columns: ['Build', 'Car', 'Up', 'Down', 'Score'], rows: stats.favorites.map((b) => [b.title, b.car, b.up, b.down, b.score]) }}
                    >
                        <RankedBuilds builds={stats.favorites} empty="No build has been voted on yet." />
                    </ChartCard>
                    <ChartCard
                        id="divisive"
                        title="Most divisive"
                        sub="Builds the squad cannot agree on: votes split close to evenly, from a big enough crowd (3 or more votes) to mean something."
                        table={{ columns: ['Build', 'Car', 'Up', 'Down'], rows: stats.divisive.map((b) => [b.title, b.car, b.up, b.down]) }}
                    >
                        <RankedBuilds builds={stats.divisive} empty="No build has votes on both sides yet." />
                    </ChartCard>
                </div>

                <StripPlot voters={stats.voters} />

                <div className="dash-grid dash-grid--2">
                    <AiReport ai={ai} />
                    <WordCloud vibes={stats.vibes} />
                </div>

                <div className="dash-grid dash-grid--2">
                    <Creators creators={stats.creators} />
                    <Wanted wanted={stats.wanted} />
                </div>
            </div>
        </div>
    );
}
