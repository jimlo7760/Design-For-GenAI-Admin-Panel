'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteRecord } from '../app/(admin)/[resource]/actions';

export default function DeleteRecordButton({ resourceKey, id, title, noun }) {
    const router = useRouter();
    const [error, setError] = useState('');
    const [pending, startTransition] = useTransition();

    function remove() {
        if (!window.confirm(`Delete “${title}”? This can’t be undone.`)) return;
        setError('');
        startTransition(async () => {
            const result = await deleteRecord(resourceKey, id);
            if (result?.error) setError(result.error);
            else router.push(`/${resourceKey}`);
        });
    }

    return (
        <div className="stack-sm">
            <button type="button" className="btn btn--danger" onClick={remove} disabled={pending}>
                {pending ? 'Deleting…' : `Delete this ${noun}`}
            </button>
            {error && <p role="alert" className="alert">{error}</p>}
        </div>
    );
}
