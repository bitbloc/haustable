import React from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { supabase } from '../../lib/supabaseClient'
import LanguageToggle from './LanguageToggle'

export default function Header({ session }) {
    const { lang, t } = useLanguage();

    return (
        <nav className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-gray-100 sticky top-0 z-40 flex justify-between items-center transition-all bg-[#FFFFFFCC]">
            <div>
                <Link to="/" className="font-bold text-lg tracking-tight text-black">{t('headline')}</Link>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest ml-2 hidden sm:inline-block">by in the haus</span>
            </div>

            <div className="flex items-center gap-3">
                <LanguageToggle />

                {session ? (
                    <div className="relative group">
                        <div className="flex items-center gap-2 bg-white pl-3 pr-1 py-1 rounded-full shadow-sm border border-gray-100">
                            <span className="text-xs font-bold text-gray-700 hidden sm:block max-w-[80px] truncate">
                                {session.user.user_metadata.full_name?.split(' ')[0]}
                            </span>
                            <img
                                src={session.user.user_metadata.avatar_url || 'https://placehold.co/100'}
                                className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                                alt="Profile"
                            />
                        </div>
                        <div className="absolute right-0 top-12 w-32 bg-white rounded-2xl shadow-xl overflow-hidden hidden group-hover:block z-50 p-1 border border-gray-100">
                            <button
                                onClick={() => supabase.auth.signOut()}
                                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl font-bold"
                            >
                                {t('logout')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <Link to="/" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
                        <Users size={18} className="text-gray-400" />
                    </Link>
                )}
            </div>
        </nav>
    )
}
