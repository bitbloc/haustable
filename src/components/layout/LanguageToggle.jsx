import React from 'react'
import { Globe } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

export default function LanguageToggle() {
    const { lang, toggleLanguage } = useLanguage();
    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-white px-3 py-2 rounded-full shadow-sm hover:text-black transition-colors"
        >
            <Globe className="w-3 h-3" />
            <span>{lang.toUpperCase()}</span>
        </button>
    )
}
