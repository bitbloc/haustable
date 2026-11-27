/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useId, useMemo, useState } from 'react';

const INK = 'text-[var(--color-ink)]';
const MUTED = 'text-[var(--color-muted)]';
const NEUTRAL = 'text-[var(--color-neutral)]';
const RULE = 'border-[var(--color-rule)]';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]';

const isSingle = (group) => group?.selection_type === 'single' || Number(group?.max_selection) === 1;

/**
 * The option choices of another menu that are always used when that menu's recipe is
 * deducted from here: a set's dish ("แกงส้มกุ้ง" is always the pickled bamboo one), a set
 * drink (always iced, always the house bean). Their stock rules are deducted with the recipe.
 *
 * Closed it is one line of text; opened, one row of choices per option group.
 */
export default function FixedChoiceEditor({ menuName = '', groups = [], value = [], onChange, loading = false, disabled = false }) {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const chosen = useMemo(() => new Set(value || []), [value]);
    const names = useMemo(() => {
        const map = new Map();
        for (const g of groups) for (const c of g.option_choices || []) map.set(c.id, c.name);
        return map;
    }, [groups]);

    const known = (value || []).filter(id => names.has(id));
    const unknown = (value || []).filter(id => !names.has(id));

    if (!groups.length && !(value || []).length) return null;

    const toggle = (group, choiceId) => {
        const next = new Set(chosen);
        if (next.has(choiceId)) {
            next.delete(choiceId);
        } else {
            if (isSingle(group)) for (const c of group.option_choices || []) next.delete(c.id);
            next.add(choiceId);
        }
        onChange?.([...next]);
    };

    const summary = known.length
        ? known.map(id => String(names.get(id) || '').trim()).join(', ')
        : 'ไม่ล็อก ตัดตามสูตรอย่างเดียว';

    return (
        <div className="text-[13px] leading-5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className={NEUTRAL}>ตัวเลือกที่ใช้เสมอ</span>
                <span className={`min-w-0 break-words ${known.length ? `font-medium ${INK}` : MUTED}`}>
                    {loading && !groups.length ? 'กำลังโหลด…' : summary}
                </span>
                {groups.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setOpen(o => !o)}
                        aria-expanded={open}
                        aria-controls={panelId}
                        disabled={disabled}
                        className={`min-h-9 px-1 -my-2 underline underline-offset-4 decoration-[var(--color-neutral)] hover:decoration-[var(--color-ink)] ${INK} cursor-pointer touch-manipulation ${FOCUS} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {open ? 'เสร็จ' : 'แก้ไข'}
                    </button>
                )}
            </div>

            {unknown.length > 0 && (
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2 font-medium text-[var(--brand-plum)]">
                    <span>มี {unknown.length} ตัวเลือกที่เมนูนี้ไม่มีแล้ว</span>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange?.(known)}
                        className={`min-h-9 px-1 -my-2 underline underline-offset-4 cursor-pointer touch-manipulation ${FOCUS} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        เอาออก
                    </button>
                </p>
            )}

            {open && groups.length > 0 && (
                <div id={panelId} className={`mt-2 pl-3 border-l ${RULE} space-y-3`}>
                    {groups.map(g => (
                        <div key={g.id} role="group" aria-label={`${g.name}${menuName ? ` ของ ${menuName}` : ''}`}>
                            <div className={`mb-1.5 ${NEUTRAL}`}>{g.name}</div>
                            <div className="flex flex-wrap gap-1.5">
                                {(g.option_choices || []).map(c => {
                                    const on = chosen.has(c.id);
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            aria-pressed={on}
                                            disabled={disabled}
                                            onClick={() => toggle(g, c.id)}
                                            className={`min-h-11 max-w-full px-3 py-2 border text-left text-[13px] leading-5 break-words cursor-pointer touch-manipulation transition-colors ${FOCUS} disabled:opacity-50 disabled:cursor-not-allowed ${
                                                on
                                                    ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]'
                                                    : `border-[var(--color-neutral)] ${MUTED} hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]`
                                            }`}
                                        >
                                            {String(c.name || '').trim()}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
