import Link from 'next/link';
import MediaForm from '../../../../../components/MediaForm';
import RenderManager from '../../../../../components/RenderManager';
import { getBuildDetail } from '../../../../../lib/admin-data';
import { requireAdmin } from '../../../../../lib/auth';
import { updateMedia } from '../../actions';

export const metadata = { title: 'Edit media' };

export default async function EditMediaPage({ params }) {
    await requireAdmin();
    const { id } = await params;
    const { build } = await getBuildDetail(id);

    return (
        <div className="page">
            <div className="container stack">
                <div>
                    <p className="crumbs"><Link href="/media">Media</Link> / <Link href={`/media/${build.id}`}>{build.title}</Link> / Edit</p>
                    <h1>Edit media</h1>
                    <p className="muted" style={{ marginTop: '0.6rem' }}>
                        Votes and the owner can’t be changed here. If you edit the parts, the owner’s “reset to the AI’s list” button in Mod Squad is unaffected.
                    </p>
                </div>
                <section className="card">
                    <h2>AI render</h2>
                    <RenderManager buildId={build.id} ownerId={build.user_id} renderUrl={build.render_url} renderModel={build.render_model} />
                </section>
                <div className="card">
                    <MediaForm
                        mode="edit"
                        action={updateMedia}
                        buildId={build.id}
                        cancelHref={`/media/${build.id}`}
                        initial={{
                            car_name: build.car_name,
                            vibe: build.vibe,
                            title: build.title,
                            tagline: build.tagline,
                            model: build.model,
                            est_cost_usd: build.est_cost_usd ?? '',
                            mods: Array.isArray(build.mods) ? build.mods : [],
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
