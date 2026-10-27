'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createRecord, updateRecord } from '../app/(admin)/[resource]/actions';

function Field({ field, error, children }) {
    const id = `f-${field.name}`;
    return (
        <div className="field">
            {field.type !== 'bool' && <label htmlFor={id}>{field.label}{field.required && <span className="muted"> (required)</span>}</label>}
            {children}
            {field.hint && !error && <p className="hint" id={`${id}-hint`}>{field.hint}</p>}
            {error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}
        </div>
    );
}

// The same form creates a record and edits one, for every section that offers either. It submits by
// hand (not as a bare <form action>) so a rejected save leaves everything you typed where it was.
// The Server Action redirects on success and only comes back with { errors } (per field) or { error }.
export default function RecordForm({ resourceKey, noun, mode, fields, initial = {}, options = {}, recordId, cancelHref }) {
    const [result, setResult] = useState(null);
    const [pending, startTransition] = useTransition();
    const errors = result?.errors ?? {};
    const creating = mode === 'create';

    function onSubmit(event) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setResult(null);
        startTransition(async () => {
            const outcome = creating ? await createRecord(resourceKey, data) : await updateRecord(resourceKey, recordId, data);
            if (outcome) setResult(outcome);
        });
    }

    function control(field) {
        const id = `f-${field.name}`;
        const value = initial[field.name];
        const a11y = {
            'aria-invalid': errors[field.name] ? 'true' : undefined,
            'aria-describedby': errors[field.name] ? `${id}-error` : field.hint ? `${id}-hint` : undefined,
        };

        switch (field.type) {
            case 'textarea':
                return <textarea id={id} name={field.name} className="input" rows={field.rows ?? 4} defaultValue={value ?? ''} maxLength={field.max} {...a11y} />;
            case 'int':
                return <input id={id} name={field.name} className="input" inputMode="numeric" defaultValue={value ?? ''} maxLength={12} style={{ maxWidth: '14rem' }} {...a11y} />;
            case 'bool':
                return (
                    <label className="check">
                        <input id={id} type="checkbox" name={field.name} defaultChecked={Boolean(value)} {...a11y} />
                        <span>{field.label}</span>
                    </label>
                );
            case 'select': {
                const choices = field.choices ?? (options[field.name] ?? []).map((option) => [option.id, option.label]);
                return (
                    <select id={id} name={field.name} className="input" defaultValue={value ?? ''} {...a11y}>
                        {(!field.required || !value) && <option value="" disabled={field.required}>{field.required ? 'Choose…' : field.blank ?? 'None'}</option>}
                        {choices.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
                    </select>
                );
            }
            case 'email':
                return <input id={id} name={field.name} type="email" className="input" autoComplete="off" spellCheck={false} defaultValue={value ?? ''} maxLength={254} {...a11y} />;
            case 'domain':
                return <input id={id} name={field.name} className="input" autoComplete="off" autoCapitalize="none" spellCheck={false} defaultValue={value ?? ''} maxLength={253} placeholder="example.edu" {...a11y} />;
            case 'url':
                return <input id={id} name={field.name} type="url" className="input" autoComplete="off" spellCheck={false} defaultValue={value ?? ''} maxLength={300} placeholder="https://" {...a11y} />;
            default:
                return <input id={id} name={field.name} className="input" defaultValue={value ?? ''} maxLength={field.max} {...a11y} />;
        }
    }

    return (
        <form className="form" onSubmit={onSubmit} noValidate>
            {(result?.error || Object.keys(errors).length > 0) && (
                <p className="alert" role="alert">
                    {result?.error ?? 'Some fields need attention. They are marked below.'}
                </p>
            )}

            <section className="form__section">
                {fields.map((field) => (
                    <Field key={field.name} field={field} error={errors[field.name]}>
                        {control(field)}
                    </Field>
                ))}
            </section>

            <div className="form-actions">
                <button type="submit" className="btn btn--primary btn--lg" disabled={pending}>
                    {pending ? 'Saving…' : creating ? `Add ${noun}` : 'Save changes'}
                </button>
                <Link href={cancelHref} className="btn btn--lg">Cancel</Link>
            </div>
        </form>
    );
}
