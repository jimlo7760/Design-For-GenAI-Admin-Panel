import Link from 'next/link';
import MediaForm from '../../../../components/MediaForm';
import { listUserOptions } from '../../../../lib/admin-data';
import { requireAdmin } from '../../../../lib/auth';
import { createMedia } from '../actions';

export const metadata = { title: 'New media' };

export default async function NewMediaPage() {
    await requireAdmin();
    const owners = await listUserOptions();

    return (
        <div className="page">
            <div className="container stack">
                <div>
                    <p className="crumbs"><Link href="/media">← All media</Link></p>
                    <h1>New media</h1>
                    <p className="muted" style={{ marginTop: '0.6rem' }}>
                        Add a build by hand, on behalf of any user. It appears in Mod Squad like any other, and starts with no votes. Mod Squad’s daily limit of 10 builds per person still applies.
                    </p>
                </div>
                <div className="card">
                    <MediaForm mode="create" action={createMedia} owners={owners} cancelHref="/media" />
                </div>
            </div>
        </div>
    );
}
