// Shared look for the stock screens (adjust, receive, count): Thai Modern tokens, hairline
// borders, ink primary actions, large touch targets for use on the shop floor.
export const INK = 'text-[var(--color-ink)]';
export const MUTED = 'text-[var(--color-muted)]';
export const NEUTRAL = 'text-[var(--color-neutral)]';
export const ACCENT = 'text-[var(--brand-plum)]';
export const RULE = 'border-[var(--color-rule)]';
export const PAPER = 'bg-[var(--color-paper)]';
export const PAPER2 = 'bg-[var(--color-paper-2)]';

export const label = `block text-xs font-medium ${MUTED} mb-1.5`;
export const input = `w-full h-11 px-3 rounded-md border ${RULE} ${PAPER} ${INK} text-base outline-none transition-colors focus:border-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]`;
export const chip = (active) => `min-h-[44px] px-3 rounded-md border text-sm transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] active:translate-y-px motion-reduce:active:translate-y-0 ${active
    ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)] font-semibold'
    : `${RULE} ${MUTED} hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]`}`;
export const primaryBtn = 'w-full h-12 rounded-md bg-[var(--color-ink)] text-[var(--color-paper)] text-base font-semibold cursor-pointer transition-[background-color,color,transform] hover:bg-[var(--action-primary-hover)] active:scale-[0.99] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] disabled:bg-[var(--color-paper-3)] disabled:text-[var(--color-neutral)] disabled:cursor-not-allowed';
export const ghostBtn = `min-h-[40px] px-3 rounded-md border ${RULE} text-sm ${MUTED} cursor-pointer hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] transition-colors`;
export const stepBtn = `w-12 h-12 shrink-0 rounded-md border ${RULE} ${PAPER} text-xl ${INK} flex items-center justify-center cursor-pointer transition-[background-color,transform] hover:bg-[var(--color-paper-2)] active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]`;

// Quiet motion: short, eased, no bounce. Respect reduced motion at the call site.
export const EASE = [0.16, 1, 0.3, 1];
export const sheetMotion = (reduce) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: 16, transition: { duration: 0.14, ease: EASE } }
});
export const panelMotion = (reduce) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE } },
    exit: { opacity: 0, transition: { duration: 0.1 } }
});
