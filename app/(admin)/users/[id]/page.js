import Link from 'next/link';
import Avatar from '../../../../components/Avatar';
import BuildThumb from '../../../../components/BuildThumb';
import VoteCounts from '../../../../components/VoteCounts';
import { adminTimeZone, getUserDetail } from '../../../../lib/admin-data';
import { displayName, requireAdmin } from '../../../../lib/auth';
import { ago, dateTime, formatInt, pct, usd } from '../../../../lib/format';

export const metadata = { title: 'User' };

export default async function UserPage({ params }) {
    await requireAdmin();
    const { id } = await params;
    const { user, builds, votes, votesTotal, searches } = await getUserDetail(id);
    const timeZone = adminTimeZone();
    const name = displayName(user);
    const upShare = user.votes_cast > 0 ? user.upvotes_cast / user.votes_cast : null;

    return (
        <div className="page">
            <div className="container container--wide stack">
                <div>
                    <p className="crumbs"><Link href="/users">← All users</Link></p>
                    <div className="row" style={{ gap: '1.1rem' }}>
                        <Avatar url={user.avatar_url} name={name} size={72} />
                        <div>
                            <h1 style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 2.8rem)' }}>{name}</h1>
                            <p className="muted">{user.email} {user.is_superadmin && <span className="pill pill--accent">Admin</span>}</p>
                        </div>
                    </div>
                </div>

                <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))' }}>
                    <div className="tile"><div className="tile__label">Builds</div><div className="tile__value">{formatInt(user.builds_count)}</div><div className="tile__sub">{user.renders_count} rendered</div></div>
                    <div className="tile"><div className="tile__label">Votes received</div><div className="tile__value"><VoteCounts up={user.upvotes_received} down={user.downvotes_received} /></div><div className="tile__sub">net score {user.score_total > 0 ? '+' : ''}{user.score_total}</div></div>
                    <div className="tile"><div className="tile__label">Votes cast</div><div className="tile__value">{formatInt(user.votes_cast)}</div><div className="tile__sub">{upShare === null ? 'none yet' : `${pct(upShare)} were upvotes`}</div></div>
                    <div className="tile"><div className="tile__label">Last seen</div><div className="tile__value" style={{ fontSize: '1.4rem' }}>{ago(user.last_sign_in_at)}</div><div className="tile__sub">joined {dateTime(user.created_at, timeZone)}</div></div>
                </div>

                <section className="card card--flush">
                    <div className="row row--between" style={{ padding: '1rem 1.25rem 0.5rem' }}>
                        <h2>Builds</h2>
                        {user.builds_count > 0 && <Link href={`/media?user=${user.id}`} className="btn btn--sm">All {user.builds_count} in Media →</Link>}
                    </div>
                    {builds.length === 0 ? (
                        <p className="muted" style={{ padding: '0 1.25rem 1.25rem' }}>No builds yet.</p>
                    ) : (
                        <div className="table-wrap">
                            <table className="table">
                                <thead><tr><th scope="col">Build</th><th scope="col">Car</th><th scope="col" className="r">Cost</th><th scope="col">Votes</th><th scope="col" className="r">Score</th><th scope="col">Made</th></tr></thead>
                                <tbody>
                                    {builds.map((build) => (
                                        <tr key={build.id}>
                                            <td>
                                                <div className="cell-user">
                                                    <BuildThumb build={build} />
                                                    <Link className="cell-user__name" href={`/media/${build.id}`}>{build.title}</Link>
                                                </div>
                                            </td>
                                            <td>{build.car_name}</td>
                                            <td className="r">{usd(build.est_cost_usd)}</td>
                                            <td><VoteCounts up={build.upvotes} down={build.downvotes} /></td>
                                            <td className="r">{build.score > 0 ? '+' : ''}{build.score}</td>
                                            <td className="nowrap">{ago(build.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <div className="dash-grid dash-grid--2">
                    <section className="card card--flush">
                        <div className="row row--between" style={{ padding: '1rem 1.25rem 0.5rem' }}>
                            <h2>Recent votes cast</h2>
                            {votesTotal > 0 && <Link href={`/votes?view=log&user=${user.id}`} className="btn btn--sm">All {formatInt(votesTotal)} →</Link>}
                        </div>
                        {votes.length === 0 ? (
                            <p className="muted" style={{ padding: '0 1.25rem 1.25rem' }}>This user has not voted yet.</p>
                        ) : (
                            <div className="table-wrap">
                                <table className="table">
                                    <tbody>
                                        {votes.map((vote) => (
                                            <tr key={vote.vote_id}>
                                                <td className={vote.value === 1 ? 'up' : 'down'}>{vote.value === 1 ? '▲ Up' : '▼ Down'}</td>
                                                <td><Link href={`/media/${vote.build_id}`}>{vote.build_title}</Link><div className="cell-user__sub">{vote.build_car}</div></td>
                                                <td className="nowrap muted">{ago(vote.created_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="card">
                        <h2>Recent part searches</h2>
                        {searches.length === 0 ? (
                            <p className="muted">None.</p>
                        ) : (
                            <ul className="stack-sm" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                                {searches.map((row, i) => <li key={i}>{row.query} <span className="muted small">· {ago(row.created_at)}</span></li>)}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
