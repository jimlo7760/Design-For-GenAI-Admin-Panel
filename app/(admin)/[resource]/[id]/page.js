import Link from 'next/link';
import { notFound } from 'next/navigation';
import DeleteRecordButton from '../../../../components/DeleteRecordButton';
import RecordCell from '../../../../components/RecordCell';
import RecordTable from '../../../../components/RecordTable';
import SetupNeeded from '../../../../components/SetupNeeded';
import { adminTimeZone, getRecord, listRecords } from '../../../../lib/admin-data';
import { requireAdmin } from '../../../../lib/auth';
import { dateTime } from '../../../../lib/format';
import { RESOURCES, resourceFor } from '../../../../lib/resources';

export async function generateMetadata({ params }) {
    const { resource } = await params;
    return { title: resourceFor(resource)?.title ?? 'Not found' };
}

// The detail page for every Week 7 section: all of one record's fields, the tables that belong to it
// (a chain's steps, a provider's models), and Edit and Delete where the section offers them.
export default async function ResourceDetailPage({ params, searchParams }) {
    await requireAdmin();
    const { resource: key, id } = await params;
    const resource = resourceFor(key);
    if (!resource) notFound();
    const flags = await searchParams;

    const record = await getRecord(resource, id);
    if (record.setupNeeded) {
        return (
            <div className="page">
                <div className="container stack">
                    <p className="crumbs"><Link href={`/${resource.key}`}>← {resource.title}</Link></p>
                    <SetupNeeded />
                </div>
            </div>
        );
    }

    const { row, totals } = record;
    const ctx = { totals };
    const timeZone = adminTimeZone();
    const details = resource.details ?? resource.columns.filter((column) => column.type !== 'title');
    const facts = details.filter((column) => column.type !== 'long' && column.type !== 'response');
    const texts = details.filter((column) => column.type === 'long' || column.type === 'response');

    const related = await Promise.all((resource.related ?? []).map(async (spec) => {
        const target = RESOURCES[spec.resource];
        const result = await listRecords(target, { filters: { [spec.column]: row.id }, pageSize: spec.limit });
        return { spec, target, ...result };
    }));

    return (
        <div className="page">
            <div className="container container--wide stack">
                <div>
                    <p className="crumbs"><Link href={`/${resource.key}`}>← {resource.title}</Link></p>
                    <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                        <h1 style={{ fontSize: 'clamp(1.8rem, 3vw + 0.8rem, 2.6rem)' }}>{resource.heading(row)}</h1>
                        {resource.ops.update && <Link href={`/${resource.key}/${row.id}/edit`} className="btn btn--primary">Edit</Link>}
                    </div>
                </div>

                {flags.created && <p className="success" role="status">Added.</p>}
                {flags.saved && <p className="success" role="status">Changes saved.</p>}

                <div className="detail">
                    <div className="stack">
                        {facts.length > 0 && (
                            <section className="card">
                                <h2>Details</h2>
                                <dl className="facts">
                                    {facts.map((column) => (
                                        <FactRow key={column.key} column={column} row={row} resource={resource} ctx={ctx} />
                                    ))}
                                </dl>
                            </section>
                        )}

                        {texts.map((column) => (
                            <section className="card" key={column.key}>
                                <h2>{column.label}</h2>
                                <RecordCell column={column} row={row} resource={resource} ctx={ctx} full />
                            </section>
                        ))}

                        {related.map(({ spec, target, rows, total, setupNeeded }) => !setupNeeded && (
                            <section className="card card--flush" key={spec.resource}>
                                <div className="row row--between" style={{ padding: '1.25rem 1.25rem 0.5rem' }}>
                                    <h2>{spec.title}</h2>
                                    {scopeParam(target, spec.column) && <Link className="btn btn--sm" href={`/${target.key}?${scopeParam(target, spec.column)}=${row.id}`}>See all →</Link>}
                                </div>
                                {rows.length === 0 ? <p className="muted" style={{ padding: '0 1.25rem 1.25rem' }}>Nothing yet.</p> : <RecordTable resource={target} rows={rows} />}
                                {total > rows.length && <p className="small" style={{ padding: '0.75rem 1.25rem' }}>Showing {rows.length} of {total}.</p>}
                            </section>
                        ))}
                    </div>

                    <div className="stack">
                        <section className="card">
                            <h2>Record</h2>
                            <dl className="facts">
                                {row.created_at && (<><dt>Added</dt><dd>{dateTime(row.created_at, timeZone)}</dd></>)}
                                {row.updated_at && (<><dt>Edited</dt><dd>{dateTime(row.updated_at, timeZone)}</dd></>)}
                                <dt>ID</dt>
                                <dd><code>{row.id}</code></dd>
                            </dl>
                        </section>

                        {resource.ops.delete && (
                            <section className="card danger-zone">
                                <h2>Danger zone</h2>
                                <p className="muted small" style={{ margin: '0.6rem 0 1rem' }}>
                                    Deleting removes this {resource.noun} for good.{resource.deleteNote ? ` ${resource.deleteNote}` : ''}
                                </p>
                                <DeleteRecordButton resourceKey={resource.key} id={row.id} title={resource.heading(row)} noun={resource.noun} />
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// The URL parameter that filters `target` by `column` (for example ?chain=<id>), if it has one.
const scopeParam = (target, column) => Object.entries(target.scopes ?? {}).find(([, scope]) => scope.column === column)?.[0];

function FactRow({ column, row, resource, ctx }) {
    return (
        <>
            <dt>{column.label}</dt>
            <dd><RecordCell column={column} row={row} resource={resource} ctx={ctx} full /></dd>
        </>
    );
}
