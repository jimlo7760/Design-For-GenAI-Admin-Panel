'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import ModsEditor from './ModsEditor';
import { DEFAULT_MODEL, LIMITS } from '../lib/media-form';

function Field({ id, label, hint, error, children }) {
    return (
        <div className="field">
            <label htmlFor={id}>{label}</label>
            {children}
            {hint && !error && <p className="hint" id={`${id}-hint`}>{hint}</p>}
            {error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}
        </div>
    );
}

// The same form creates a build and edits one. It submits by hand (not as a bare <form action>) so a
// rejected save leaves everything you typed exactly where it was. The Server Action redirects on
// success and only comes back with { errors } (per field) or { error } (a sentence).
export default function MediaForm({ mode, action, owners = [], initial = {}, buildId, cancelHref }) {
    const [result, setResult] = useState(null);
    const [pending, startTransition] = useTransition();
    const errors = result?.errors ?? {};
    const creating = mode === 'create';

    function onSubmit(event) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setResult(null);
        startTransition(async () => {
            const outcome = await action(data);
            if (outcome) setResult(outcome);
        });
    }

    const invalid = (name) => (errors[name] ? { 'aria-invalid': 'true', 'aria-describedby': `${name}-error` } : {});

    return (
        <form className="form" onSubmit={onSubmit} noValidate>
            {buildId && <input type="hidden" name="id" value={buildId} />}

            {(result?.error || Object.keys(errors).length > 0) && (
                <p className="alert" role="alert">
                    {result?.error ?? 'Some fields need attention. They are marked below.'}
                </p>
            )}

            <section className="form__section">
                <h2 className="form__heading"><span className="form__num">1</span> The car</h2>
                {creating && (
                    <Field id="user_id" label="Who does this build belong to?" error={errors.user_id} hint="They will see it in Mod Squad under their own name.">
                        <select id="user_id" name="user_id" className="input" defaultValue={initial.user_id ?? ''} {...invalid('user_id')}>
                            <option value="" disabled>Choose a user…</option>
                            {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}
                        </select>
                    </Field>
                )}
                <div className="grid-2">
                    <Field id="car_name" label="Car" error={errors.car_name} hint="As Mod Squad writes it, for example “Mazda MX-5 Miata (NA)”.">
                        <input id="car_name" name="car_name" className="input" defaultValue={initial.car_name ?? ''} maxLength={LIMITS.car_name} {...invalid('car_name')} />
                    </Field>
                    <Field id="vibe" label="Vibe" error={errors.vibe} hint="What the build is for, in the owner’s words.">
                        <input id="vibe" name="vibe" className="input" defaultValue={initial.vibe ?? ''} maxLength={LIMITS.vibe} {...invalid('vibe')} />
                    </Field>
                </div>
            </section>

            <section className="form__section">
                <h2 className="form__heading"><span className="form__num">2</span> The build</h2>
                <div className="grid-2">
                    <Field id="title" label="Title" error={errors.title}>
                        <input id="title" name="title" className="input" defaultValue={initial.title ?? ''} maxLength={LIMITS.title} {...invalid('title')} />
                    </Field>
                    <Field id="model" label="Made by" error={errors.model} hint="The AI model, or who wrote it by hand.">
                        <input id="model" name="model" className="input" defaultValue={initial.model ?? (creating ? DEFAULT_MODEL : '')} maxLength={LIMITS.model} {...invalid('model')} />
                    </Field>
                </div>
                <Field id="tagline" label="Tagline" error={errors.tagline}>
                    <input id="tagline" name="tagline" className="input" defaultValue={initial.tagline ?? ''} maxLength={LIMITS.tagline} {...invalid('tagline')} />
                </Field>
                {creating && (
                    <Field id="prompt" label="Prompt (optional)" error={errors.prompt} hint="Kept with the build so you can see what produced it. Leave blank for a hand-made build.">
                        <textarea id="prompt" name="prompt" className="input" rows={3} defaultValue={initial.prompt ?? ''} maxLength={LIMITS.prompt} />
                    </Field>
                )}
            </section>

            <section className="form__section">
                <h2 className="form__heading"><span className="form__num">3</span> The parts</h2>
                <ModsEditor initial={initial.mods ?? []} error={errors.mods} />
                <Field id="est_cost_usd" label="Estimated total cost (USD)" error={errors.est_cost_usd} hint="Leave blank to add up the parts above. Only works when every part has a price.">
                    <input id="est_cost_usd" name="est_cost_usd" className="input" inputMode="numeric" defaultValue={initial.est_cost_usd ?? ''} maxLength={12} style={{ maxWidth: '14rem' }} {...invalid('est_cost_usd')} />
                </Field>
            </section>

            <div className="form-actions">
                <button type="submit" className="btn btn--primary btn--lg" disabled={pending}>
                    {pending ? 'Saving…' : creating ? 'Create build' : 'Save changes'}
                </button>
                <Link href={cancelHref} className="btn btn--lg">Cancel</Link>
            </div>
        </form>
    );
}
