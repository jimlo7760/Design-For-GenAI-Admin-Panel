'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteMedia } from '../app/(admin)/media/actions';

export default function DeleteMediaButton({ buildId, title, votes }) {
    const router = useRouter();
    const [error, setError] = useState('');
    const [pending, startTransition] = useTransition();

    function remove() {
        const detail = votes > 0 ? ` Its ${votes} vote${votes === 1 ? '' : 's'} will be deleted with it.` : '';
        if (!window.confirm(`Delete “${title}”?${detail} This can’t be undone.`)) return;
        setError('');
        startTransition(async () => {
            const result = await deleteMedia(buildId);
            if (result?.error) setError(result.error);
            else router.push('/media');
        });
    }

    return (
        <div className="stack-sm">
            <button type="button" className="btn btn--danger" onClick={remove} disabled={pending}>
                {pending ? 'Deleting…' : 'Delete this build'}
            </button>
            {error && <p role="alert" className="alert">{error}</p>}
        </div>
    );
}
