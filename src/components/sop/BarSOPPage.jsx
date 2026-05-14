import React, { useState } from 'react';
import { ArrowLeft, Search, RefreshCw, X, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useBarSOP from '../../hooks/useBarSOP';
import SOPRecipeCard from './SOPRecipeCard';

/**
 * BarSOPPage — Staff SOP Viewer
 * 🌑 Dark theme, mobile-first, tablet-optimized
 * Designed for glanceability during bar service
 */
export default function BarSOPPage() {
    const navigate = useNavigate();
    const [showSearch, setShowSearch] = useState(false);

    const {
        recipes,
        categories,
        glassSizes,
        loading,
        activeCategory,
        setActiveCategory,
        searchQuery,
        setSearchQuery,
        scaleIngredients,
        refresh
    } = useBarSOP({ department: 'bar', staffMode: true });

    return (
        <div className="min-h-screen bg-[#0D0D0D] text-white font-sans selection:bg-[#DFFF00] selection:text-black">
            {/* ── Header ── */}
            <header className="sticky top-0 z-30 bg-[#0D0D0D]/95 backdrop-blur-md border-b border-[#1A1A1A]">
                <div className="px-4 pt-3 pb-2 safe-area-inset-top">
                    {/* Top Bar */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/staff')}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1A1A1A] hover:bg-[#2A2A2A] transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-[#999999]" />
                            </button>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-[#DFFF00]" />
                                    <span>BAR SOP</span>
                                </h1>
                                <p className="text-[10px] text-[#666666] uppercase tracking-widest">
                                    สูตรเครื่องดื่ม
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowSearch(!showSearch)}
                                className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                                    showSearch 
                                        ? 'bg-[#DFFF00] text-[#0D0D0D]'
                                        : 'bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#999999]'
                                }`}
                            >
                                {showSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={refresh}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#999999] transition-colors"
                            >
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    {showSearch && (
                        <div className="mb-3 animate-fade-in">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555]" />
                                <input
                                    type="text"
                                    placeholder="ค้นหาเมนู..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#DFFF00]/50 transition-colors"
                                    autoFocus
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-white"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Category Pills */}
                <div className="flex overflow-x-auto px-4 pb-3 gap-2 no-scrollbar">
                    {/* All Tab */}
                    <button
                        onClick={() => setActiveCategory(null)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                            activeCategory === null
                                ? 'bg-[#DFFF00] text-[#0D0D0D] shadow-lg shadow-[#DFFF00]/20'
                                : 'bg-[#1A1A1A] text-[#888888] hover:text-white border border-[#2A2A2A]'
                        }`}
                    >
                        ทั้งหมด
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 ${
                                activeCategory === cat.id
                                    ? 'bg-[#DFFF00] text-[#0D0D0D] shadow-lg shadow-[#DFFF00]/20'
                                    : 'bg-[#1A1A1A] text-[#888888] hover:text-white border border-[#2A2A2A]'
                            }`}
                        >
                            <span className="text-base">{cat.icon}</span>
                            {cat.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* ── Main Content ── */}
            <main className="px-4 pt-4 pb-20 safe-area-inset-bottom max-w-3xl mx-auto">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-20 bg-[#1A1A1A] rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : recipes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-[#555555]">
                        <BookOpen className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-lg font-bold mb-1">
                            {searchQuery ? 'ไม่พบเมนูที่ค้นหา' : 'ยังไม่มี SOP ในหมวดนี้'}
                        </p>
                        <p className="text-sm">
                            {searchQuery ? `"${searchQuery}"` : 'ติดต่อ Admin เพื่อเพิ่ม SOP'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Count */}
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs text-[#555555] font-bold uppercase tracking-wider">
                                {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
                            </span>
                            {searchQuery && (
                                <span className="text-xs text-[#DFFF00]">
                                    ค้นหา: "{searchQuery}"
                                </span>
                            )}
                        </div>

                        {/* Recipe Cards */}
                        {recipes.map(recipe => (
                            <SOPRecipeCard
                                key={recipe.id}
                                recipe={recipe}
                                glassSizes={glassSizes}
                                scaleIngredients={scaleIngredients}
                                darkMode={true}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* ── Footer (subtle branding) ── */}
            <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#0D0D0D] to-transparent h-16 pointer-events-none z-10" />
        </div>
    );
}
