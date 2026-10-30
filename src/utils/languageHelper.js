// Languages a page may switch to. 'zh' is accepted but pages fall back to English
// until their own strings cover it.
export const SUPPORTED_LANGUAGES = ['th', 'en', 'zh'];
export const LANG_STORAGE_KEY = 'haus_lang';

export const readStoredLanguage = () => {
    try {
        const stored = localStorage.getItem(LANG_STORAGE_KEY);
        return SUPPORTED_LANGUAGES.includes(stored) ? stored : null;
    } catch {
        return null;
    }
};

// Best guess from the phone's language list: Thai if Thai appears anywhere, else English
export const detectDeviceLanguage = () => {
    const list = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
    return list.some(code => String(code || '').toLowerCase().startsWith('th')) ? 'th' : 'en';
};
