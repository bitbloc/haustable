import React from 'react';
import { ZoomIn, ZoomOut, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export default function AdsBookletModal({
    activeTab,
    setActiveTab,
    activeMenuIndex,
    setActiveMenuIndex,
    regularMenuImages,
    promoMenuImages,
    menuImageLoading,
    setMenuImageLoading,
    optimizeImageUrl,
    onClose
}) {
    const currentImages = activeTab === 'promo' ? promoMenuImages : regularMenuImages;
    if (currentImages.length === 0) return null;
    const activeUrl = currentImages[activeMenuIndex];

    return (
        <div 
            className="w-full max-w-lg bg-[var(--color-hallmark-paper)] rounded-sm p-4 border border-[var(--color-hallmark-ink)] flex flex-col items-center z-40 relative my-8" 
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex justify-between items-center w-full mb-3 pb-2 border-b border-[var(--color-hallmark-rule)]">
                <span className="font-mono text-[10px] font-bold text-[var(--color-hallmark-ink-muted)]">
                    // ORIGINAL MENU BOOKLET
                </span>
                <button 
                    onClick={onClose}
                    className="text-[10px] font-mono font-bold hover:text-[var(--color-brand)] cursor-pointer text-[var(--color-hallmark-ink)] bg-transparent border-0 outline-none"
                >
                    [ CLOSE ]
                </button>
            </div>

            {/* Tab Switcher inside Modal */}
            <div className="flex border border-[var(--color-hallmark-rule)] rounded-sm mb-3 w-full text-[10px] font-mono overflow-hidden">
                {regularMenuImages.length > 0 && (
                    <button
                        onClick={() => {
                            setActiveTab('regular');
                            setActiveMenuIndex(0);
                            setMenuImageLoading(true);
                        }}
                        className={`flex-1 py-2 text-center transition-all cursor-pointer font-bold border-r border-[var(--color-hallmark-rule)] last:border-r-0 ${activeTab === 'regular' ? 'bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink)]' : 'text-[var(--color-hallmark-ink-muted)] bg-transparent'}`}
                    >
                        MAIN MENU
                    </button>
                )}
                {promoMenuImages.length > 0 && (
                    <button
                        onClick={() => {
                            setActiveTab('promo');
                            setActiveMenuIndex(0);
                            setMenuImageLoading(true);
                        }}
                        className={`flex-1 py-2 text-center transition-all cursor-pointer font-bold border-r border-[var(--color-hallmark-rule)] last:border-r-0 ${activeTab === 'promo' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-hallmark-ink-muted)] bg-transparent'}`}
                    >
                        PROMOTIONS
                    </button>
                )}
            </div>

            {/* Slider Component */}
            <div className="w-full flex flex-col items-center">
                <TransformWrapper
                    key={`${activeTab}-${activeMenuIndex}-${activeUrl}`}
                    initialScale={1}
                    minScale={1}
                    maxScale={4}
                    centerOnInit={true}
                >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <div className="w-full flex flex-col items-center">
                            <div className="flex items-center justify-between w-full mb-3 px-1 text-neutral-600 bg-[var(--color-hallmark-paper-dark)] p-1.5 rounded-sm border border-[var(--color-hallmark-rule)]">
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => zoomIn()} className="w-7 h-7 rounded-sm flex items-center justify-center hover:bg-[var(--color-hallmark-paper)] text-neutral-800 transition-all cursor-pointer border border-[var(--color-hallmark-rule)] bg-transparent"><ZoomIn size={12} /></button>
                                    <button type="button" onClick={() => zoomOut()} className="w-7 h-7 rounded-sm flex items-center justify-center hover:bg-[var(--color-hallmark-paper)] text-neutral-800 transition-all cursor-pointer border border-[var(--color-hallmark-rule)] bg-transparent"><ZoomOut size={12} /></button>
                                    <button type="button" onClick={() => resetTransform()} className="w-7 h-7 rounded-sm flex items-center justify-center hover:bg-[var(--color-hallmark-paper)] text-neutral-800 transition-all cursor-pointer border border-[var(--color-hallmark-rule)] bg-transparent"><RefreshCw size={10} /></button>
                                </div>
                                <span className="text-[10px] font-bold text-[var(--color-hallmark-ink)] font-mono px-2">
                                    PAGE {activeMenuIndex + 1} / {currentImages.length}
                                </span>
                            </div>

                            <div className="relative w-full aspect-[4/5] rounded-sm overflow-hidden border border-[var(--color-hallmark-rule)] bg-neutral-50 cursor-grab active:cursor-grabbing">
                                {menuImageLoading && (
                                    <div className="absolute inset-0 bg-neutral-100 flex items-center justify-center">
                                        <div className="w-5 h-5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                                <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex items-center justify-center">
                                    <img
                                        src={optimizeImageUrl(activeUrl, 900)}
                                        alt={`Menu Page ${activeMenuIndex + 1}`}
                                        onLoad={() => setMenuImageLoading(false)}
                                        className={`w-full h-full object-contain transition-opacity duration-300 ${menuImageLoading ? 'opacity-0' : 'opacity-100'}`}
                                    />
                                </TransformComponent>
                            </div>
                        </div>
                    )}
                </TransformWrapper>

                {/* Navigation Controls */}
                <div className="flex items-center justify-between w-full mt-4">
                    <button
                        disabled={activeMenuIndex === 0}
                        onClick={() => {
                            setActiveMenuIndex(prev => Math.max(0, prev - 1));
                            setMenuImageLoading(true);
                        }}
                        className="w-8 h-8 rounded-sm border border-[var(--color-hallmark-rule)] flex items-center justify-center text-[var(--color-hallmark-ink-muted)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100/50 active:scale-95 transition-all cursor-pointer bg-transparent"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    
                    <div className="flex gap-1 overflow-x-auto max-w-[180px] no-scrollbar py-1">
                        {currentImages.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setActiveMenuIndex(i);
                                    setMenuImageLoading(true);
                                }}
                                className={`w-1.5 h-1.5 rounded-full transition-all flex-shrink-0 ${activeMenuIndex === i ? 'bg-[var(--color-brand)] scale-110' : 'bg-[var(--color-hallmark-rule)] opacity-40 hover:opacity-100'}`}
                            />
                        ))}
                    </div>

                    <button
                        disabled={activeMenuIndex === currentImages.length - 1}
                        onClick={() => {
                            setActiveMenuIndex(prev => Math.min(currentImages.length - 1, prev + 1));
                            setMenuImageLoading(true);
                        }}
                        className="w-8 h-8 rounded-sm border border-[var(--color-hallmark-rule)] flex items-center justify-center text-[var(--color-hallmark-ink-muted)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100/50 active:scale-95 transition-all cursor-pointer bg-transparent"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
