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
        <div className="sop-rams-page min-h-screen bg-[var(--color-hallmark-paper)] text-[var(--color-hallmark-ink)] font-[var(--font-body)] selection:bg-[var(--color-brand)] selection:text-white">
            {/* ── Header ── */}
            <header className="sticky top-0 z-30 bg-[var(--color-hallmark-paper)]/95 backdrop-blur-md border-b border-[var(--color-hallmark-rule)]">
                <div className="px-4 pt-3 pb-2 safe-area-inset-top">
                    {/* Top Bar */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/staff')}
                                className="w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--color-hallmark-paper-dark)] hover:bg-neutral-200 border border-[var(--color-hallmark-rule)] transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-[var(--color-hallmark-ink)]" />
                            </button>
                            <div>
                                <h1 className="text-lg font-mono font-bold tracking-tight flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-[var(--color-brand)]" />
                                    <span>BAR SOP</span>
                                </h1>
                                <p className="text-[10px] text-[var(--color-hallmark-ink-muted)] uppercase tracking-widest font-bold">
                                    สูตรเครื่องดื่ม
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowSearch(!showSearch)}
                                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors border ${
                                    showSearch 
                                        ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white'
                                        : 'bg-[var(--color-hallmark-paper-dark)] border-[var(--color-hallmark-rule)] hover:bg-neutral-200 text-[var(--color-hallmark-ink)]'
                                }`}
                            >
                                {showSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={refresh}
                                className="w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--color-hallmark-paper-dark)] hover:bg-neutral-200 border border-[var(--color-hallmark-rule)] text-[var(--color-hallmark-ink)] transition-colors"
                            >
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    {showSearch && (
                        <div className="mb-3 animate-fade-in">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-hallmark-ink-muted)]" />
                                <input
                                    type="text"
                                    placeholder="ค้นหาเมนู..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-lg py-3 pl-10 pr-4 text-sm text-[var(--color-hallmark-ink)] placeholder-[var(--color-hallmark-ink-muted)]/70 focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                                    autoFocus
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-hallmark-ink-muted)] hover:text-[var(--color-hallmark-ink)]"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Category Pills */}
                <div 
                    className="flex overflow-x-auto px-4 pb-3 gap-2 no-scrollbar"
                    onWheel={e => {
                        if (e.deltaY !== 0) {
                            e.preventDefault();
                            e.currentTarget.scrollLeft += e.deltaY * 0.8;
                        }
                    }}
                >
                    {/* All Tab */}
                    <button
                        onClick={() => setActiveCategory(null)}
                        className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                            activeCategory === null
                                ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)] shadow-sm'
                                : 'bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink-muted)] hover:text-[var(--color-hallmark-ink)] border-[var(--color-hallmark-rule)]'
                        }`}
                    >
                        ทั้งหมด
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 border ${
                                activeCategory === cat.id
                                    ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)] shadow-sm'
                                    : 'bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink-muted)] hover:text-[var(--color-hallmark-ink)] border-[var(--color-hallmark-rule)]'
                            }`}
                        >
                            <span className="text-base">{cat.icon}</span>
                            {cat.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* ── Main Content ── */}
            <main className="px-4 pt-4 pb-20 safe-area-inset-bottom max-w-6xl mx-auto">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-20 bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : recipes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-[var(--color-hallmark-ink-muted)]">
                        <BookOpen className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-lg font-mono font-bold mb-1">
                            {searchQuery ? 'ไม่พบเมนูที่ค้นหา' : 'ยังไม่มี SOP ในหมวดนี้'}
                        </p>
                        <p className="text-sm">
                            {searchQuery ? `"${searchQuery}"` : 'ติดต่อ Admin เพื่อเพิ่ม SOP'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Count */}
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs text-[var(--color-hallmark-ink-muted)] font-mono font-bold uppercase tracking-wider">
                                {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
                            </span>
                            {searchQuery && (
                                <span className="text-xs text-[var(--color-brand)] font-bold">
                                    ค้นหา: "{searchQuery}"
                                </span>
                            )}
                        </div>

                        {/* Recipe Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recipes.map(recipe => (
                                <SOPRecipeCard
                                    key={recipe.id}
                                    recipe={recipe}
                                    glassSizes={glassSizes}
                                    scaleIngredients={scaleIngredients}
                                    darkMode={false}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* ── Footer (subtle branding) ── */}
            <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[var(--color-hallmark-paper)] to-transparent h-16 pointer-events-none z-10" />
        </div>
    );
}
