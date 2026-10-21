import Link from 'next/link';
import DeleteMediaButton from '../../../../components/DeleteMediaButton';
import SplitBar from '../../../../components/charts/SplitBar';
import UserCell from '../../../../components/UserCell';
import { adminTimeZone, getBuildDetail } from '../../../../lib/admin-data';
import { requireAdmin } from '../../../../lib/auth';
import { ago, dateTime, formatInt, pct, usd } from '../../../../lib/format';
import { shareOfTotal } from '../../../../lib/mods';

export const metadata = { title: 'Media' };

export default async function MediaDetailPage({ params, searchParams }) {
    await requireAdmin();
    const { id } = await params;
    const flags = await searchParams;
    const { build, owner, votes, votesTotal } = await getBuildDetail(id);
    const timeZone = adminTimeZone();
    const mods = Array.isArray(build.mods) ? build.mods : [];
    const image = build.render_url || build.photo_url || build.image_url;
    const total = build.upvotes + build.downvotes;

    return (
        <div className="page">
            <div className="container container--wide stack">
                <div>
                    <p className="crumbs"><Link href="/media">← All media</Link></p>
                    <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                        <div>
                            <h1 style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 2.8rem)' }}>{build.title}</h1>
                            <p className="muted" style={{ marginTop: '0.5rem' }}>{build.tagline}</p>
                        </div>
                        <Link href={`/media/${build.id}/edit`} className="btn btn--primary">Edit</Link>
                    </div>
                </div>

                {flags.created && <p className="success" role="status">Build created.</p>}
                {flags.saved && <p className="success" role="status">Changes saved.</p>}

                <div className="detail">
                    <div className="stack">
                        <section className="card">
                            {image ? (
                                <img className="render-frame" src={image} alt={build.render_url ? 'The AI render of this build' : `Photo of a ${build.car_name}`} />
                            ) : (
                                <div className="render-frame render-frame--empty">No image</div>
                            )}
                            <p className="muted small" style={{ marginTop: '0.6rem' }}>
                                {build.render_url
                                    ? `AI render${build.render_model ? ` by ${build.render_model}` : ''}${build.rendered_at ? `, ${ago(build.rendered_at)}` : ''}`
                                    : build.photo_url
                                        ? 'The owner’s own photo. No AI render yet.'
                                        : build.image_url
                                            ? <>Reference photo{build.image_credit ? ` by ${build.image_credit}` : ''}{build.image_license ? ` (${build.image_license})` : ''}{build.image_source_url && <> · <a href={build.image_source_url} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a></>}. No AI render yet.</>
                                            : 'No AI render yet.'}
                            </p>
                        </section>

                        <section className="card">
                            <div className="row row--between">
                                <h2>Parts</h2>
                                <span className="mod__cost">{usd(build.est_cost_usd)}</span>
                            </div>
                            {mods.length === 0 ? (
                                <p className="muted">No parts.</p>
                            ) : (
                                <ul className="mods" style={{ marginTop: '1rem' }}>
                                    {mods.map((mod, index) => {
                                        const cost = shareOfTotal(mods, build.est_cost_usd, index);
                                        return (
                                            <li className="mod" key={index}>
                                                <div className="mod__head">
                                                    <span className="pill">{mod.category}</span>
                                                    <span className="mod__part">{mod.part}</span>
                                                    {mod.source === 'you' && <span className="pill pill--warn">Added by owner</span>}
                                                </div>
                                                <span className="mod__cost" title={Number.isFinite(mod.cost_usd) ? undefined : 'Estimated share of the total'}>
                                                    {Number.isFinite(mod.cost_usd) ? usd(mod.cost_usd) : cost === null ? '–' : `≈ ${usd(cost)}`}
                                                </span>
                                                {mod.detail && <span className="mod__detail">{mod.detail}</span>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>

                        <section className="card">
                            <h2>Prompt</h2>
                            <p className="muted small" style={{ marginBottom: '0.75rem' }}>What was sent to the model: the rules, the car and the vibe.</p>
                            <pre className="code" style={{ whiteSpace: 'pre-wrap' }}>{build.prompt}</pre>
                        </section>
                    </div>

                    <div className="stack">
                        <section className="card">
                            <h2>Details</h2>
                            <dl className="facts">
                                <dt>Owner</dt>
                                <dd><UserCell id={build.user_id} {...build.profiles} email={owner?.email} size={32} /></dd>
                                <dt>Car</dt>
                                <dd>{build.car_name}</dd>
                                <dt>Vibe</dt>
                                <dd>{build.vibe}</dd>
                                <dt>Made by</dt>
                                <dd>{build.model}</dd>
                                <dt>Created</dt>
                                <dd>{dateTime(build.created_at, timeZone)}</dd>
                                {build.mods_edited_at && (<><dt>Parts edited</dt><dd>{dateTime(build.mods_edited_at, timeZone)} by the owner</dd></>)}
                                <dt>ID</dt>
                                <dd><code>{build.id}</code></dd>
                            </dl>
                        </section>

                        <section className="card">
                            <div className="row row--between">
                                <h2>Votes</h2>
                                <span className="mod__cost">{build.score > 0 ? '+' : ''}{build.score}</span>
                            </div>
                            <div style={{ margin: '0.9rem 0' }}>
                                <SplitBar up={build.upvotes} down={build.downvotes} />
                                {total > 0 && <p className="muted small" style={{ marginTop: '0.4rem' }}>{pct(build.upvotes / total)} approval</p>}
                            </div>
                            {votes.length === 0 ? (
                                <p className="muted">No votes yet.</p>
                            ) : (
                                <div className="table-wrap">
                                    <table className="table">
                                        <tbody>
                                            {votes.slice(0, 10).map((vote) => (
                                                <tr key={vote.vote_id}>
                                                    <td className={vote.value === 1 ? 'up' : 'down'}>{vote.value === 1 ? '▲' : '▼'}<span className="sr-only">{vote.value === 1 ? 'Upvote' : 'Downvote'}</span></td>
                                                    <td><Link href={`/users/${vote.voter_id}`}>{vote.voter_name ?? vote.voter_email}</Link></td>
                                                    <td className="nowrap muted">{ago(vote.created_at)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {votesTotal > 10 && <p className="small" style={{ marginTop: '0.6rem' }}>Showing 10 of {formatInt(votesTotal)}.</p>}
                            {votesTotal > 0 && <Link href={`/votes?view=log&build=${build.id}`} className="btn btn--sm" style={{ marginTop: '0.75rem' }}>All votes on this build →</Link>}
                        </section>

                        <section className="card danger-zone">
                            <h2>Danger zone</h2>
                            <p className="muted small" style={{ margin: '0.6rem 0 1rem' }}>
                                Deleting removes the build, its votes and its render file for good. The owner’s own page and the public feed lose it immediately.
                            </p>
                            <DeleteMediaButton buildId={build.id} title={build.title} votes={total} />
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
