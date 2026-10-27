import Link from 'next/link';
import { notFound } from 'next/navigation';
import Pager from '../../../components/Pager';
import RecordTable from '../../../components/RecordTable';
import SearchBar from '../../../components/SearchBar';
import SetupNeeded from '../../../components/SetupNeeded';
import Tabs from '../../../components/Tabs';
import { listRecords } from '../../../lib/admin-data';
import { requireAdmin } from '../../../lib/auth';
import { formatInt } from '../../../lib/format';
import { isUuid } from '../../../lib/mods';
import { cleanSearch, oneOf, pageNumber, withParams } from '../../../lib/query';
import { resourceFor } from '../../../lib/resources';

export async function generateMetadata({ params }) {
    const { resource } = await params;
    return { title: resourceFor(resource)?.title ?? 'Not found' };
}

// One list page for every Week 7 section: search, sort, a "filtered to one X" link from a related
// page, paging, and a New button where the section can create.
export default async function ResourceListPage({ params, searchParams }) {
    await requireAdmin();
    const { resource: key } = await params;
    const resource = resourceFor(key);
    if (!resource) notFound();

    const raw = await searchParams;
    const q = cleanSearch(raw.q);
    const sort = oneOf(raw.sort, Object.keys(resource.sorts), resource.defaultSort);
    const page = pageNumber(raw.page);

    // ?chain=<id> and the like: only ids, and only the filters this section declares.
    const scopes = {};
    const filters = {};
    for (const [param, scope] of Object.entries(resource.scopes ?? {})) {
        if (isUuid(raw[param])) {
            scopes[param] = raw[param];
            filters[scope.column] = raw[param];
        }
    }
    const urlParams = { q, sort: sort === resource.defaultSort ? '' : sort, ...scopes };
    const path = `/${resource.key}`;

    const { rows, total, pageSize, totals, setupNeeded } = await listRecords(resource, { q, sort, page, filters });
    const filtered = q || Object.keys(scopes).length > 0;

    return (
        <div className="page">
            <div className="container container--wide stack">
                <header className="page-head">
                    <div>
                        <h1>{resource.title}</h1>
                        <p>{resource.blurb}</p>
                        {resource.readOnlyNote && <p className="muted small" style={{ marginTop: '0.4rem' }}>{resource.readOnlyNote}</p>}
                    </div>
                    {resource.ops.create && <Link href={`${path}/new`} className="btn btn--primary">+ New {resource.noun}</Link>}
                </header>

                {setupNeeded ? (
                    <SetupNeeded />
                ) : (
                    <div>
                        <div className="toolbar">
                            {resource.search.length > 0 && (
                                <SearchBar action={path} q={q} hidden={{ sort: urlParams.sort, ...scopes }} placeholder={`Search ${resource.nouns}`} label={`Search ${resource.nouns}`} />
                            )}
                            <span className="toolbar__count">{formatInt(total)} {total === 1 ? resource.noun : resource.nouns}</span>
                        </div>
                        {Object.keys(resource.sorts).length > 1 && (
                            <div className="toolbar">
                                <Tabs label={`Sort ${resource.nouns}`} path={path} params={urlParams} name="sort" options={resource.sorts} current={sort} fallback={resource.defaultSort} />
                            </div>
                        )}
                        {Object.entries(scopes).map(([param, id]) => {
                            const scope = resource.scopes[param];
                            return (
                                <p className="notice" style={{ marginBottom: '1rem' }} key={param}>
                                    Showing one {scope.label}’s {resource.nouns}. <Link href={withParams(path, { ...urlParams, [param]: '' }, {})}>Show them all</Link> · <Link href={`/${scope.from}/${id}`}>View that {scope.label}</Link>
                                </p>
                            );
                        })}

                        <div className="card card--flush">
                            {rows.length === 0 ? (
                                <div className="empty">
                                    <h2>{page > 1 ? 'That page is empty' : `No ${resource.nouns} found`}</h2>
                                    <p>{page > 1 ? 'There is nothing this far down the list.' : filtered ? 'Nothing matches those filters.' : `There are no ${resource.nouns} yet.`}</p>
                                    {(filtered || page > 1)
                                        ? <Link href={path} className="btn">Clear filters</Link>
                                        : resource.ops.create && <Link href={`${path}/new`} className="btn btn--primary">+ New {resource.noun}</Link>}
                                </div>
                            ) : (
                                <RecordTable resource={resource} rows={rows} ctx={{ totals }} />
                            )}
                            {total > 0 && <Pager path={path} params={urlParams} page={page} pageSize={pageSize} total={total} />}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
