import Link from 'next/link';
import { notFound } from 'next/navigation';
import RecordForm from '../../../../components/RecordForm';
import { listOptions } from '../../../../lib/admin-data';
import { requireAdmin } from '../../../../lib/auth';
import { RESOURCES, resourceFor } from '../../../../lib/resources';

export async function generateMetadata({ params }) {
    const { resource } = await params;
    const found = resourceFor(resource);
    return { title: found ? `New ${found.noun}` : 'Not found' };
}

export default async function NewRecordPage({ params }) {
    await requireAdmin();
    const { resource: key } = await params;
    const resource = resourceFor(key);
    if (!resource?.ops.create) notFound();

    // The choices for each "pick one" field, read from the section it points at.
    const options = {};
    for (const field of resource.fields) {
        if (field.optionsFrom) options[field.name] = await listOptions(RESOURCES[field.optionsFrom]);
    }

    return (
        <div className="page">
            <div className="container stack">
                <div>
                    <p className="crumbs"><Link href={`/${resource.key}`}>{resource.title}</Link> / New</p>
                    <h1>New {resource.noun}</h1>
                </div>
                <div className="card">
                    <RecordForm
                        resourceKey={resource.key}
                        noun={resource.noun}
                        mode="create"
                        fields={resource.fields}
                        initial={resource.defaults ?? {}}
                        options={options}
                        cancelHref={`/${resource.key}`}
                    />
                </div>
            </div>
        </div>
    );
}
