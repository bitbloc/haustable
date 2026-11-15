// Shared look for the stock screens (adjust, receive, count): Thai Modern tokens, hairline
// borders, ink primary actions, large touch targets for use on the shop floor.
export const INK = 'text-[oklch(18%_0.012_28)]';
export const MUTED = 'text-[oklch(42%_0.010_28)]';
export const NEUTRAL = 'text-[oklch(55%_0.010_28)]';
export const ACCENT = 'text-[oklch(52%_0.16_28)]';
export const RULE = 'border-[oklch(85%_0.012_28)]';
export const PAPER = 'bg-[oklch(99%_0.004_28)]';
export const PAPER2 = 'bg-[oklch(94%_0.010_28)]';

export const label = `block text-xs font-medium ${MUTED} mb-1.5`;
export const input = `w-full h-11 px-3 rounded-md border ${RULE} ${PAPER} ${INK} text-base outline-none transition-colors focus:border-[oklch(18%_0.012_28)]`;
export const chip = (active) => `h-10 px-3 rounded-md border text-sm transition-colors ${active
    ? 'border-[oklch(18%_0.012_28)] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-semibold'
    : `${RULE} ${MUTED} hover:border-[oklch(18%_0.012_28)] hover:text-[oklch(18%_0.012_28)]`}`;
export const primaryBtn = 'w-full h-12 rounded-md bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-base font-semibold transition-[background-color,opacity,transform] hover:bg-[oklch(25%_0.012_28)] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed';
export const ghostBtn = `h-9 px-3 rounded-md border ${RULE} text-sm ${MUTED} hover:border-[oklch(18%_0.012_28)] hover:text-[oklch(18%_0.012_28)] transition-colors`;
export const stepBtn = `w-12 h-12 shrink-0 rounded-md border ${RULE} ${PAPER} text-xl ${INK} flex items-center justify-center transition-[background-color,transform] hover:bg-[oklch(94%_0.010_28)] active:scale-95`;

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
