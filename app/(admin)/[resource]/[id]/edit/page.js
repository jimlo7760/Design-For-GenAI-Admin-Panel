import Link from 'next/link';
import { notFound } from 'next/navigation';
import RecordForm from '../../../../../components/RecordForm';
import SetupNeeded from '../../../../../components/SetupNeeded';
import { getRecord, listOptions } from '../../../../../lib/admin-data';
import { requireAdmin } from '../../../../../lib/auth';
import { RESOURCES, resourceFor } from '../../../../../lib/resources';

export async function generateMetadata({ params }) {
    const { resource } = await params;
    const found = resourceFor(resource);
    return { title: found ? `Edit ${found.noun}` : 'Not found' };
}

export default async function EditRecordPage({ params }) {
    await requireAdmin();
    const { resource: key, id } = await params;
    const resource = resourceFor(key);
    if (!resource?.ops.update) notFound();

    const record = await getRecord(resource, id);
    if (record.setupNeeded) {
        return (
            <div className="page">
                <div className="container stack"><SetupNeeded /></div>
            </div>
        );
    }
    const { row } = record;

    const options = {};
    for (const field of resource.fields) {
        if (field.optionsFrom) options[field.name] = await listOptions(RESOURCES[field.optionsFrom]);
    }

    // What each field starts as: the saved value, with numbers as text so the box can show them.
    const initial = {};
    for (const field of resource.fields) {
        const value = row[field.name];
        initial[field.name] = field.type === 'bool' ? Boolean(value) : value ?? '';
    }

    return (
        <div className="page">
            <div className="container stack">
                <div>
                    <p className="crumbs"><Link href={`/${resource.key}`}>{resource.title}</Link> / <Link href={`/${resource.key}/${row.id}`}>{resource.heading(row)}</Link> / Edit</p>
                    <h1>Edit {resource.noun}</h1>
                </div>
                <div className="card">
                    <RecordForm
                        resourceKey={resource.key}
                        noun={resource.noun}
                        mode="edit"
                        fields={resource.fields}
                        initial={initial}
                        options={options}
                        recordId={row.id}
                        cancelHref={`/${resource.key}/${row.id}`}
                    />
                </div>
            </div>
        </div>
    );
}
