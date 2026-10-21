'use client';

import { useId, useState } from 'react';
import { usd } from '../lib/format';

const CATEGORIES = ['Wheels', 'Tires', 'Suspension', 'Brakes', 'Engine', 'Intake', 'Exhaust', 'Exterior', 'Aero', 'Interior', 'Lighting', 'Audio', 'Other'];
const MAX = 12;

let nextKey = 0;
const blank = () => ({ key: nextKey++, category: '', part: '', detail: '', cost: '' });
const fromMod = (mod) => ({
    key: nextKey++,
    category: mod.category ?? '',
    part: mod.part ?? '',
    detail: mod.detail ?? '',
    cost: Number.isFinite(Number(mod.cost_usd)) && mod.cost_usd !== null && mod.cost_usd !== undefined && mod.cost_usd !== '' ? String(mod.cost_usd) : '',
    source: mod.source,
});

// The list of parts on a build, as rows you can add, remove and reorder. The whole list is written
// into one hidden field (`mods`, as JSON) that the form submits; the server cleans and checks it again.
export default function ModsEditor({ initial = [], error }) {
    const [rows, setRows] = useState(() => (initial.length > 0 ? initial.map(fromMod) : [blank()]));
    const listId = useId();

    const update = (key, field, value) => setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
    const remove = (key) => setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : [blank()]));
    const move = (index, by) =>
        setRows((current) => {
            const target = index + by;
            if (target < 0 || target >= current.length) return current;
            const copy = [...current];
            [copy[index], copy[target]] = [copy[target], copy[index]];
            return copy;
        });

    const serialised = JSON.stringify(
        rows.map((row) => ({
            category: row.category,
            part: row.part,
            detail: row.detail,
            ...(row.cost.trim() !== '' ? { cost_usd: row.cost.trim() } : {}),
            ...(row.source ? { source: row.source } : {}),
        }))
    );
    const priced = rows.filter((row) => row.cost.trim() !== '' && Number.isFinite(Number(row.cost)));
    const total = priced.reduce((sum, row) => sum + Number(row.cost), 0);

    return (
        <div className="mods-editor">
            <input type="hidden" name="mods" value={serialised} />
            <datalist id={listId}>
                {CATEGORIES.map((category) => <option key={category} value={category} />)}
            </datalist>

            {rows.map((row, index) => (
                <fieldset className="mod-edit" key={row.key} style={{ margin: 0, border: '1px solid var(--line)' }}>
                    <legend className="small muted" style={{ padding: '0 0.4rem' }}>Part {index + 1}</legend>
                    <div className="mod-edit__grid">
                        <div className="field">
                            <label htmlFor={`cat-${row.key}`}>Category</label>
                            <input id={`cat-${row.key}`} className="input" list={listId} value={row.category} onChange={(e) => update(row.key, 'category', e.target.value)} maxLength={40} placeholder="Wheels" />
                        </div>
                        <div className="field">
                            <label htmlFor={`part-${row.key}`}>Part</label>
                            <input id={`part-${row.key}`} className="input" value={row.part} onChange={(e) => update(row.key, 'part', e.target.value)} maxLength={120} placeholder="Enkei RPF1 15x7" required />
                        </div>
                        <div className="field">
                            <label htmlFor={`cost-${row.key}`}>Cost (USD)</label>
                            <input id={`cost-${row.key}`} className="input" inputMode="numeric" value={row.cost} onChange={(e) => update(row.key, 'cost', e.target.value)} maxLength={7} placeholder="1200" />
                        </div>
                    </div>
                    <div className="field">
                        <label htmlFor={`detail-${row.key}`}>Detail</label>
                        <input id={`detail-${row.key}`} className="input" value={row.detail} onChange={(e) => update(row.key, 'detail', e.target.value)} maxLength={300} placeholder="One sentence on what it does for the build" />
                    </div>
                    <div className="row">
                        <button type="button" className="btn btn--sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move part ${index + 1} up`}>↑</button>
                        <button type="button" className="btn btn--sm" onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label={`Move part ${index + 1} down`}>↓</button>
                        <button type="button" className="btn btn--sm btn--danger" onClick={() => remove(row.key)} aria-label={`Remove part ${index + 1}`}>Remove</button>
                    </div>
                </fieldset>
            ))}

            <div className="row">
                <button type="button" className="btn" onClick={() => setRows((current) => [...current, blank()])} disabled={rows.length >= MAX}>+ Add a part</button>
                <span className="muted small" aria-live="polite">
                    {rows.length} of {MAX} parts · {priced.length === rows.length ? `adds up to ${usd(total)}` : `${priced.length} priced, ${usd(total)} so far`}
                </span>
            </div>
            {error && <p className="field-error" role="alert">{error}</p>}
        </div>
    );
}
