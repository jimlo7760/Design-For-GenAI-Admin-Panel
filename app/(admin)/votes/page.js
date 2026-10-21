import Link from 'next/link';
import Pager from '../../../components/Pager';
import SearchBar from '../../../components/SearchBar';
import Tabs from '../../../components/Tabs';
import SplitBar from '../../../components/charts/SplitBar';
import { RATING_SORTS, VOTE_FILTERS, adminTimeZone, getVoteTotals, listRatings, listVotes } from '../../../lib/admin-data';
import { requireAdmin } from '../../../lib/auth';
import { ago, dateTime, formatInt, pct } from '../../../lib/format';
import { isUuid } from '../../../lib/mods';
import { cleanSearch, oneOf, pageNumber } from '../../../lib/query';

export const metadata = { title: 'Votes' };

const VIEWS = { ratings: 'Ratings by build', log: 'Vote log' };

export default async function VotesPage({ searchParams }) {
    await requireAdmin();
    const raw = await searchParams;
    const view = oneOf(raw.view, Object.keys(VIEWS), 'ratings');
    const q = cleanSearch(raw.q);
    const page = pageNumber(raw.page);
    const build = isUuid(raw.build) ? raw.build : '';
    const user = isUuid(raw.user) ? raw.user : '';

    const totals = await getVoteTotals();
    const approval = totals.total > 0 ? totals.up / totals.total : null;

    return (
        <div className="page">
            <div className="container container--wide stack">
                <header className="page-head">
                    <div>
                        <h1>Votes</h1>
                        <p>Every upvote and downvote the squad has cast. This area is read-only: votes can only be changed by the people who cast them.</p>
                    </div>
                </header>

                <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))' }}>
                    <div className="tile"><div className="tile__label">Votes cast</div><div className="tile__value">{formatInt(totals.total)}</div></div>
                    <div className="tile"><div className="tile__label"><span className="up">▲</span> Upvotes</div><div className="tile__value">{formatInt(totals.up)}</div></div>
                    <div className="tile"><div className="tile__label"><span className="down">▼</span> Downvotes</div><div className="tile__value">{formatInt(totals.down)}</div></div>
                    <div className="tile"><div className="tile__label">Approval</div><div className="tile__value">{pct(approval)}</div><div className="tile__sub">of votes are upvotes</div></div>
                </div>

                <div>
                    <div className="toolbar">
                        <Tabs label="Choose a view" path="/votes" params={{}} name="view" options={VIEWS} current={view} fallback="ratings" />
                    </div>
                    {view === 'ratings'
                        ? <Ratings raw={raw} q={q} page={page} />
                        : <Log raw={raw} q={q} page={page} build={build} user={user} />}
                </div>
            </div>
        </div>
    );
}

async function Ratings({ raw, q, page }) {
    const sort = oneOf(raw.sort, Object.keys(RATING_SORTS), 'top');
    const params = { view: 'ratings', q, sort: sort === 'top' ? '' : sort };
    const { rows, total, pageSize, truncated } = await listRatings({ q, sort, page });

    return (
        <>
            <div className="toolbar">
                <SearchBar action="/votes" q={q} hidden={{ view: 'ratings', sort: params.sort }} placeholder="Search title or car" label="Search ratings" />
                <span className="toolbar__count">{formatInt(total)} {total === 1 ? 'build' : 'builds'}</span>
            </div>
            <div className="toolbar">
                <Tabs label="Sort ratings" path="/votes" params={params} name="sort" options={RATING_SORTS} current={sort} fallback="top" />
            </div>
            {truncated && <p className="notice" style={{ marginBottom: '1rem' }}>There are more than 20,000 builds; only the first 20,000 are ranked here.</p>}
            <div className="card card--flush">
                {rows.length === 0 ? (
                    <div className="empty"><h2>{page > 1 ? 'That page is empty' : 'No builds found'}</h2><p>{page > 1 ? 'There is nothing this far down the list.' : q ? `Nothing matches “${q}”.` : 'Nothing has been generated yet.'}</p>{(q || page > 1) && <Link href="/votes" className="btn">Back to the first page</Link>}</div>
                ) : (
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th scope="col">Build</th>
                                    <th scope="col">Up / down</th>
                                    <th scope="col" className="r">Votes</th>
                                    <th scope="col" className="r">Approval</th>
                                    <th scope="col" className="r">Score</th>
                                    <th scope="col"><span className="sr-only">Details</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <Link className="cell-user__name" href={`/media/${row.id}`}>{row.title}</Link>
                                            <div className="cell-user__sub">{row.car_name}</div>
                                        </td>
                                        <td style={{ minWidth: '12rem' }}><SplitBar up={row.upvotes} down={row.downvotes} /></td>
                                        <td className="r">{formatInt(row.votes)}</td>
                                        <td className="r">{pct(row.approval)}</td>
                                        <td className={`r ${row.score > 0 ? 'up' : row.score < 0 ? 'down' : ''}`}>{row.score > 0 ? '+' : ''}{row.score}</td>
                                        <td>{row.votes > 0 && <Link className="btn btn--sm" href={`/votes?view=log&build=${row.id}`}>Who voted</Link>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {total > 0 && <Pager path="/votes" params={params} page={page} pageSize={pageSize} total={total} />}
            </div>
        </>
    );
}

async function Log({ raw, q, page, build, user }) {
    const filter = oneOf(raw.filter, Object.keys(VOTE_FILTERS), 'all');
    const params = { view: 'log', q, filter: filter === 'all' ? '' : filter, build, user };
    const { rows, total, pageSize } = await listVotes({ q, filter, page, buildId: build, userId: user });

    return (
        <>
            <div className="toolbar">
                <SearchBar action="/votes" q={q} hidden={{ view: 'log', filter: params.filter, build, user }} placeholder="Search voter, email, build or car" label="Search votes" />
                <span className="toolbar__count">{formatInt(total)} {total === 1 ? 'vote' : 'votes'}</span>
            </div>
            <div className="toolbar">
                <Tabs label="Filter votes" path="/votes" params={params} name="filter" options={VOTE_FILTERS} current={filter} fallback="all" />
            </div>
            {(build || user) && (
                <p className="notice" style={{ marginBottom: '1rem' }}>
                    Showing the votes {build ? 'on one build' : 'cast by one user'}.{' '}
                    <Link href={`/votes?view=log${q ? `&q=${encodeURIComponent(q)}` : ''}`}>Show all votes</Link> ·{' '}
                    <Link href={build ? `/media/${build}` : `/users/${user}`}>{build ? 'View the build' : 'View the user'}</Link>
                </p>
            )}
            <div className="card card--flush">
                {rows.length === 0 ? (
                    <div className="empty"><h2>{page > 1 ? 'That page is empty' : 'No votes found'}</h2><p>{page > 1 ? 'There is nothing this far down the list.' : 'Nothing matches those filters.'}</p><Link href="/votes?view=log" className="btn">Clear filters</Link></div>
                ) : (
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th scope="col">Vote</th>
                                    <th scope="col">Voter</th>
                                    <th scope="col">Build</th>
                                    <th scope="col">Owner</th>
                                    <th scope="col">When</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((vote) => (
                                    <tr key={vote.vote_id}>
                                        <td><span className={`pill ${vote.value === 1 ? 'pill--up' : 'pill--down'}`}>{vote.value === 1 ? '▲ Up' : '▼ Down'}</span></td>
                                        <td>
                                            <Link className="cell-user__name" href={`/users/${vote.voter_id}`}>{vote.voter_name ?? vote.voter_email}</Link>
                                            {vote.voter_name && <div className="cell-user__sub">{vote.voter_email}</div>}
                                        </td>
                                        <td>
                                            <Link className="cell-user__name" href={`/media/${vote.build_id}`}>{vote.build_title}</Link>
                                            <div className="cell-user__sub">{vote.build_car}</div>
                                        </td>
                                        <td><Link href={`/users/${vote.build_owner_id}`}>{vote.build_owner_name ?? 'Unnamed'}</Link></td>
                                        <td className="nowrap" title={dateTime(vote.created_at, adminTimeZone())}>{ago(vote.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {total > 0 && <Pager path="/votes" params={params} page={page} pageSize={pageSize} total={total} />}
            </div>
        </>
    );
}
