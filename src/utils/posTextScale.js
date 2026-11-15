/**
 * POS text size (per device).
 *
 * The POS was laid out for ~1280px-wide screens. On the Sunmi D2s Plus (15.6" Full HD) the same
 * layout renders its many hard-coded 7–11px labels too small to read. Instead of rewriting 400+
 * font-size classes, the POS multiplies the small sizes by --pos-text-scale (see index.css,
 * `.pos-container` rules). Staff can change it from the header; the choice is stored per device.
 */
const STORAGE_KEY = 'pos_text_scale';

export const POS_TEXT_SCALE_PRESETS = [1, 1.15, 1.3, 1.45];

// Large screens (Sunmi D2s Plus at 1920px) start one step up; 1280px screens stay at 100%.
export function getDefaultPosTextScale() {
    if (typeof window === 'undefined') return 1;
    return window.innerWidth >= 1600 ? 1.15 : 1;
}

export function getPosTextScale() {
    try {
        const saved = parseFloat(localStorage.getItem(STORAGE_KEY));
        if (POS_TEXT_SCALE_PRESETS.includes(saved)) return saved;
    } catch (e) {}
    return getDefaultPosTextScale();
}

export function applyPosTextScale(scale = getPosTextScale()) {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--pos-text-scale', String(scale));
}

export function setPosTextScale(scale) {
    if (!POS_TEXT_SCALE_PRESETS.includes(scale)) return;
    try {
        localStorage.setItem(STORAGE_KEY, String(scale));
    } catch (e) {}
    applyPosTextScale(scale);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pos-text-scale-changed', { detail: { scale } }));
    }
}

export function nextPosTextScale(current = getPosTextScale()) {
    const idx = POS_TEXT_SCALE_PRESETS.indexOf(current);
    return POS_TEXT_SCALE_PRESETS[(idx + 1) % POS_TEXT_SCALE_PRESETS.length];
}
