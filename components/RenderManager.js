'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { attachRender, removeRender } from '../app/(admin)/media/actions';
import { createClient } from '../lib/supabase/client';
import { MAX_RENDER_BYTES, RENDER_BUCKET, RENDER_TYPES, renderPath } from '../lib/renders';

// Shows the build's AI render and lets an admin replace or remove it. The file goes from the browser
// straight to Storage with the admin's own session (so the bucket's rules decide whether it is
// allowed, and nothing large passes through a Server Action); then a Server Action links it.
export default function RenderManager({ buildId, ownerId, renderUrl, renderModel }) {
    const router = useRouter();
    const [message, setMessage] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [pending, startTransition] = useTransition();

    async function upload(event) {
        const input = event.target;
        const file = input.files?.[0];
        input.value = ''; // lets the same file be picked again later
        if (!file) return;

        setMessage(null);
        const extension = RENDER_TYPES[file.type];
        if (!extension) return setMessage({ type: 'error', text: 'Please choose a PNG, JPG or WebP image.' });
        if (file.size > MAX_RENDER_BYTES) return setMessage({ type: 'error', text: 'That image is over 8 MB. Please choose a smaller one.' });

        setUploading(true);
        const supabase = createClient();
        const path = renderPath(ownerId, buildId, extension);
        const { error } = await supabase.storage.from(RENDER_BUCKET).upload(path, file, { contentType: file.type });
        if (error) {
            setUploading(false);
            return setMessage({ type: 'error', text: error.message });
        }

        const result = await attachRender(buildId, path);
        setUploading(false);
        if (result?.error) return setMessage({ type: 'error', text: result.error });
        setMessage({ type: 'success', text: 'Render saved.' });
        router.refresh();
    }

    function remove() {
        if (!window.confirm('Remove this render? The image file is deleted too.')) return;
        setMessage(null);
        startTransition(async () => {
            const result = await removeRender(buildId);
            if (result?.error) setMessage({ type: 'error', text: result.error });
            else {
                setMessage({ type: 'success', text: 'Render removed.' });
                router.refresh();
            }
        });
    }

    return (
        <div className="stack-sm" style={{ maxWidth: '36rem' }}>
            {renderUrl ? (
                <img className="render-frame" src={renderUrl} alt="The AI render of this build" />
            ) : (
                <div className="render-frame render-frame--empty">No AI render yet</div>
            )}
            {renderUrl && renderModel && <p className="muted small">Made by {renderModel}</p>}
            <div className="row">
                <label className="btn btn--sm" style={{ cursor: 'pointer' }}>
                    {uploading ? 'Uploading…' : renderUrl ? 'Replace image' : 'Upload image'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={uploading || pending} className="sr-only" />
                </label>
                {renderUrl && (
                    <button type="button" className="btn btn--sm btn--danger" onClick={remove} disabled={uploading || pending}>
                        {pending ? 'Removing…' : 'Remove'}
                    </button>
                )}
            </div>
            <p className="hint">PNG, JPG or WebP, up to 8 MB.</p>
            {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={message.type === 'error' ? 'alert' : 'success'}>{message.text}</p>}
        </div>
    );
}
