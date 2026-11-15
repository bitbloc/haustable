// Languages a page may switch to. The QR table page and the /link landing page cover
// all four; other pages read English for 'zh' and 'lo' until their strings cover them.
export const SUPPORTED_LANGUAGES = ['th', 'en', 'zh', 'lo'];
export const LANG_STORAGE_KEY = 'haus_lang';

// Value for <html lang>, so the browser picks the right glyphs (Simplified Chinese
// rather than Japanese forms for shared Han characters) and line breaking rules.
export const HTML_LANG = { th: 'th', en: 'en', zh: 'zh-Hans', lo: 'lo' };

export const readStoredLanguage = () => {
    try {
        const stored = localStorage.getItem(LANG_STORAGE_KEY);
        return SUPPORTED_LANGUAGES.includes(stored) ? stored : null;
    } catch {
        return null;
    }
};

const deviceLanguageCodes = () => {
    const list = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
    return list.map(code => String(code || '').toLowerCase());
};

// Best guess from the phone's language list: Thai if Thai appears anywhere, then
// Chinese or Lao if either appears, else English
export const detectDeviceLanguage = () => {
    const codes = deviceLanguageCodes();
    if (codes.some(code => code.startsWith('th'))) return 'th';
    const match = codes.find(code => code.startsWith('zh') || code.startsWith('lo'));
    if (match) return match.startsWith('zh') ? 'zh' : 'lo';
    return 'en';
};

// For pages that are Thai by default (the /link landing page): only a phone whose
// first language is Chinese or Lao switches away from Thai. Many Thai guests keep
// their phone in English, so English is not a reason to leave Thai.
export const detectForeignDeviceLanguage = () => {
    const first = deviceLanguageCodes()[0] || '';
    if (first.startsWith('zh')) return 'zh';
    if (first.startsWith('lo')) return 'lo';
    return null;
};
