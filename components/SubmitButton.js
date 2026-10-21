'use client';

import { useFormStatus } from 'react-dom';

export default function SubmitButton({ children, pending: pendingLabel = 'Saving…', className = 'btn btn--primary' }) {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className={className} disabled={pending}>
            {pending ? pendingLabel : children}
        </button>
    );
}
