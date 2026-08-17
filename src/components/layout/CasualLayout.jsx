/* Hallmark · component: CasualLayout · genre: modern-minimal · theme: dieter-rams-thai-modern
 * states: default
 * contrast: pass (APCA / WCAG AAA compliant)
 */
import React from 'react';
import ReededGlassBackground from './ReededGlassBackground';

export default function CasualLayout({ children, backgroundImage }) {
  const fallbackBg = '/assets/background-mood.webp';
  const finalBg = backgroundImage || fallbackBg;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink)] font-[var(--font-body)] selection:bg-[var(--color-brand)] selection:text-black">
      
      {/* 1. WebGL Background Layer (Reeded Glass Effect) */}
      <div className="fixed inset-0 z-0 bg-[var(--color-hallmark-paper-dark)] pointer-events-none">
        <ReededGlassBackground imageUrl={finalBg} />
        
        {/* Subtle Ambient Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-hallmark-paper-dark)] via-[var(--color-hallmark-paper-dark)]/40 to-[var(--color-hallmark-paper-dark)]/20 pointer-events-none z-10" />
      </div>

      {/* 2. Content Container (Full-bleed on Mobile, Centered Terminal on Desktop) */}
      <main className="relative z-10 flex flex-col items-center justify-start min-h-screen w-full max-w-lg mx-auto px-0 sm:px-3 sm:py-6">
        <div className="w-full flex flex-col bg-[var(--color-hallmark-paper)] sm:border border-[var(--color-hallmark-rule)] shadow-2xl">
          {children}
        </div>
      </main>

    </div>
  );
}
