import Link from 'next/link';
import Pager from '../../../components/Pager';
import SearchBar from '../../../components/SearchBar';
import Tabs from '../../../components/Tabs';
import UserCell from '../../../components/UserCell';
import { IMAGE_FILTERS, listImages } from '../../../lib/admin-data';
import { requireAdmin } from '../../../lib/auth';
import { ago, formatInt } from '../../../lib/format';
import { cleanSearch, oneOf, pageNumber } from '../../../lib/query';

export const metadata = { title: 'Images' };

// The picture to show for a build, given the filter: the one the filter asks for, else the best we have.
function pick(build, filter) {
    if (filter === 'photos' && build.photo_url) return { src: build.photo_url, kind: 'Owner photo' };
    if (filter === 'reference' && build.image_url) return { src: build.image_url, kind: 'Reference photo' };
    if (build.render_url) return { src: build.render_url, kind: 'AI render' };
    if (build.photo_url) return { src: build.photo_url, kind: 'Owner photo' };
    return { src: build.image_url, kind: 'Reference photo' };
}

export default async function ImagesPage({ searchParams }) {
    await requireAdmin();
    const raw = await searchParams;
    const q = cleanSearch(raw.q);
    const filter = oneOf(raw.filter, Object.keys(IMAGE_FILTERS), 'all');
    const sort = oneOf(raw.sort, ['new', 'old'], 'new');
    const page = pageNumber(raw.page);
    const params = { q, filter: filter === 'all' ? '' : filter, sort: sort === 'new' ? '' : sort };

    const { rows, total, pageSize } = await listImages({ q, filter, sort, page });

    return (
        <div className="page">
            <div className="container container--wide stack">
                <header className="page-head">
                    <div>
                        <h1>Images</h1>
                        <p>Every picture on a build: the AI render, the owner’s own photo and the reference photo. Open a build’s edit page to upload a new render, replace it or remove it.</p>
                    </div>
                </header>

                <div>
                    <div className="toolbar">
                        <SearchBar action="/images" q={q} hidden={{ filter: params.filter, sort: params.sort }} placeholder="Search title or car" label="Search images" />
                        <span className="toolbar__count">{formatInt(total)} {total === 1 ? 'build with images' : 'builds with images'}</span>
                    </div>
                    <div className="toolbar">
                        <Tabs label="Filter images" path="/images" params={params} name="filter" options={IMAGE_FILTERS} current={filter} fallback="all" />
                        <Tabs label="Sort images" path="/images" params={params} name="sort" options={{ new: 'Newest', old: 'Oldest' }} current={sort} fallback="new" />
                    </div>

                    {rows.length === 0 ? (
                        <div className="card">
                            <div className="empty">
                                <h2>{page > 1 ? 'That page is empty' : 'No images found'}</h2>
                                <p>{page > 1 ? 'There is nothing this far down the list.' : q || filter !== 'all' ? 'Nothing matches those filters.' : 'No build has a picture yet.'}</p>
                                {(q || filter !== 'all' || page > 1) && <Link href="/images" className="btn">Clear filters</Link>}
                            </div>
                        </div>
                    ) : (
                        <ul className="gallery">
                            {rows.map((build) => {
                                const shown = pick(build, filter);
                                const kinds = [build.render_url && 'AI render', build.photo_url && 'Owner photo', build.image_url && 'Reference photo'].filter(Boolean);
                                return (
                                    <li className="card gallery__item" key={build.id}>
                                        <img className="render-frame" src={shown.src} alt={`${shown.kind} of ${build.title}`} loading="lazy" />
                                        <div className="stack-sm">
                                            <Link className="cell-user__name" href={`/media/${build.id}`}>{build.title}</Link>
                                            <span className="muted small">{build.car_name} · {ago(build.created_at)}</span>
                                            <span className="row" style={{ gap: '0.3rem' }}>
                                                {kinds.map((kind) => <span className="pill" key={kind}>{kind}</span>)}
                                            </span>
                                            {build.render_url && build.render_model && <span className="muted small">Render by {build.render_model}</span>}
                                            <UserCell id={build.user_id} {...build.profiles} size={24} />
                                        </div>
                                        <div className="row">
                                            <Link className="btn btn--sm" href={`/media/${build.id}`}>View</Link>
                                            <Link className="btn btn--sm" href={`/media/${build.id}/edit`}>{build.render_url ? 'Replace or remove render' : 'Upload render'}</Link>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {total > 0 && <div className="card card--flush" style={{ marginTop: '1rem' }}><Pager path="/images" params={params} page={page} pageSize={pageSize} total={total} /></div>}
                </div>
            </div>
        </div>
    );
}
