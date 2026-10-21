import Link from 'next/link';
import Pager from '../../../components/Pager';
import SearchBar from '../../../components/SearchBar';
import Tabs from '../../../components/Tabs';
import UserCell from '../../../components/UserCell';
import { adminTimeZone, listUsers, USER_SORTS } from '../../../lib/admin-data';
import { requireAdmin } from '../../../lib/auth';
import { ago, formatInt, shortDate } from '../../../lib/format';
import { cleanSearch, oneOf, pageNumber } from '../../../lib/query';

export const metadata = { title: 'Users' };

export default async function UsersPage({ searchParams }) {
    await requireAdmin();
    const raw = await searchParams;
    const q = cleanSearch(raw.q);
    const sort = oneOf(raw.sort, Object.keys(USER_SORTS), 'newest');
    const page = pageNumber(raw.page);
    const params = { q, sort: sort === 'newest' ? '' : sort };

    const { rows, total, pageSize } = await listUsers({ q, sort, page });
    const timeZone = adminTimeZone();

    return (
        <div className="page">
            <div className="container container--wide stack">
                <header className="page-head">
                    <div>
                        <h1>Users</h1>
                        <p>Everyone who has signed in with Google. This list is read-only: people edit their own name and photo in Mod Squad.</p>
                    </div>
                </header>

                <div>
                    <div className="toolbar">
                        <SearchBar action="/users" q={q} hidden={{ sort: params.sort }} placeholder="Search name or email" label="Search users" />
                        <Tabs label="Sort users" path="/users" params={params} name="sort" options={USER_SORTS} current={sort} fallback="newest" />
                        <span className="toolbar__count">{formatInt(total)} {total === 1 ? 'user' : 'users'}</span>
                    </div>

                    <div className="card card--flush">
                        {rows.length === 0 ? (
                            <div className="empty">
                                <h2>{page > 1 ? 'That page is empty' : 'No users found'}</h2>
                                <p>{page > 1 ? 'There is nothing this far down the list.' : q ? `Nobody matches “${q}”.` : 'Nobody has signed in yet.'}</p>
                                {(q || page > 1) && <Link href="/users" className="btn">Clear search</Link>}
                            </div>
                        ) : (
                            <div className="table-wrap">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th scope="col">User</th>
                                            <th scope="col">Joined</th>
                                            <th scope="col">Last seen</th>
                                            <th scope="col" className="r">Builds</th>
                                            <th scope="col" className="r">Renders</th>
                                            <th scope="col">Votes received</th>
                                            <th scope="col" className="r">Score</th>
                                            <th scope="col">Votes cast</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((user) => (
                                            <tr key={user.id}>
                                                <td>
                                                    <UserCell {...user} />
                                                    {user.is_superadmin && <span className="pill pill--accent" style={{ marginLeft: '2.9rem' }}>Admin</span>}
                                                </td>
                                                <td className="nowrap">{shortDate(user.created_at, timeZone)}</td>
                                                <td className="nowrap" title={user.last_sign_in_at ?? ''}>{ago(user.last_sign_in_at)}</td>
                                                <td className="r">{formatInt(user.builds_count)}</td>
                                                <td className="r">{formatInt(user.renders_count)}</td>
                                                <td>
                                                    <span className="votes-inline">
                                                        <span className="up">▲ {user.upvotes_received}</span>
                                                        <span className="down">▼ {user.downvotes_received}</span>
                                                    </span>
                                                </td>
                                                <td className={`r ${user.score_total > 0 ? 'up' : user.score_total < 0 ? 'down' : ''}`}>{user.score_total > 0 ? '+' : ''}{user.score_total}</td>
                                                <td>
                                                    <Link href={`/votes?view=log&user=${user.id}`} className="votes-inline">
                                                        <span>{formatInt(user.votes_cast)}</span>
                                                        {user.votes_cast > 0 && <span className="muted">({user.upvotes_cast}▲ {user.downvotes_cast}▼)</span>}
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {total > 0 && <Pager path="/users" params={params} page={page} pageSize={pageSize} total={total} />}
                    </div>
                </div>
            </div>
        </div>
    );
}
