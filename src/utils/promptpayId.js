// Kept apart from printerHelper so customer checkout does not pull the printer / shift code.
export function normalizePromptPayId(rawId) {
    if (!rawId) return '0985284217';
    let clean = String(rawId).replace(/[^0-9]/g, '');
    if (clean.startsWith('66') && clean.length === 11) {
        clean = '0' + clean.slice(2);
    }
    return clean || '0985284217';
}
