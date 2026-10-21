import Link from 'next/link';
import BuildThumb from '../../../components/BuildThumb';
import Pager from '../../../components/Pager';
import SearchBar from '../../../components/SearchBar';
import Tabs from '../../../components/Tabs';
import UserCell from '../../../components/UserCell';
import VoteCounts from '../../../components/VoteCounts';
import { BUILD_FILTERS, BUILD_SORTS, listBuilds } from '../../../lib/admin-data';
import { requireAdmin } from '../../../lib/auth';
import { ago, formatInt, usd } from '../../../lib/format';
import { cleanSearch, oneOf, pageNumber } from '../../../lib/query';
import { isUuid } from '../../../lib/mods';

export const metadata = { title: 'Media' };

export default async function MediaPage({ searchParams }) {
    await requireAdmin();
    const raw = await searchParams;
    const q = cleanSearch(raw.q);
    const filter = oneOf(raw.filter, Object.keys(BUILD_FILTERS), 'all');
    const sort = oneOf(raw.sort, Object.keys(BUILD_SORTS), 'new');
    const user = isUuid(raw.user) ? raw.user : '';
    const page = pageNumber(raw.page);
    const params = { q, filter: filter === 'all' ? '' : filter, sort: sort === 'new' ? '' : sort, user };

    const { rows, total, pageSize } = await listBuilds({ q, filter, sort, page, userId: user });

    return (
        <div className="page">
            <div className="container container--wide stack">
                <header className="page-head">
                    <div>
                        <h1>Media</h1>
                        <p>Every AI-generated build: its title, parts, price, render and votes. Open one to edit or delete it, or make a new one.</p>
                    </div>
                    <Link href="/media/new" className="btn btn--primary">+ New media</Link>
                </header>

                <div>
                    <div className="toolbar">
                        <SearchBar action="/media" q={q} hidden={{ filter: params.filter, sort: params.sort, user }} placeholder="Search title, car or vibe" label="Search media" />
                        <span className="toolbar__count">{formatInt(total)} {total === 1 ? 'build' : 'builds'}</span>
                    </div>
                    <div className="toolbar">
                        <Tabs label="Filter media" path="/media" params={params} name="filter" options={BUILD_FILTERS} current={filter} fallback="all" />
                        <Tabs label="Sort media" path="/media" params={params} name="sort" options={BUILD_SORTS} current={sort} fallback="new" />
                    </div>
                    {user && (
                        <p className="notice" style={{ marginBottom: '1rem' }}>
                            Showing one user’s builds. <Link href={{ pathname: '/media', query: { ...(q && { q }) } }}>Show everyone’s</Link> · <Link href={`/users/${user}`}>View that user</Link>
                        </p>
                    )}

                    <div className="card card--flush">
                        {rows.length === 0 ? (
                            <div className="empty">
                                <h2>{page > 1 ? 'That page is empty' : 'No builds found'}</h2>
                                <p>{page > 1 ? 'There is nothing this far down the list.' : q || filter !== 'all' || user ? 'Nothing matches those filters.' : 'Nothing has been generated yet.'}</p>
                                {(q || filter !== 'all' || user || page > 1) ? <Link href="/media" className="btn">Clear filters</Link> : <Link href="/media/new" className="btn btn--primary">+ New media</Link>}
                            </div>
                        ) : (
                            <div className="table-wrap">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Build</th>
                                            <th scope="col">Owner</th>
                                            <th scope="col" className="r">Cost</th>
                                            <th scope="col">Votes</th>
                                            <th scope="col" className="r">Score</th>
                                            <th scope="col">Made</th>
                                            <th scope="col"><span className="sr-only">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((build) => (
                                            <tr key={build.id}>
                                                <td>
                                                    <div className="cell-user">
                                                        <BuildThumb build={build} />
                                                        <div className="cell-user__text">
                                                            <Link className="cell-user__name" href={`/media/${build.id}`}>{build.title}</Link>
                                                            <span className="cell-user__sub">{build.car_name}</span>
                                                            <span className="row" style={{ gap: '0.3rem', marginTop: '0.2rem' }}>
                                                                {build.render_url && <span className="pill">Render</span>}
                                                                {build.mods_edited_at && <span className="pill pill--warn">Parts edited</span>}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><UserCell id={build.user_id} {...build.profiles} size={28} /></td>
                                                <td className="r">{usd(build.est_cost_usd)}</td>
                                                <td><VoteCounts up={build.upvotes} down={build.downvotes} /></td>
                                                <td className={`r ${build.score > 0 ? 'up' : build.score < 0 ? 'down' : ''}`}>{build.score > 0 ? '+' : ''}{build.score}</td>
                                                <td className="nowrap" title={build.created_at}>{ago(build.created_at)}</td>
                                                <td><Link className="btn btn--sm" href={`/media/${build.id}/edit`}>Edit</Link></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {total > 0 && <Pager path="/media" params={params} page={page} pageSize={pageSize} total={total} />}
                    </div>
                </div>
            </div>
        </div>
    );
}
