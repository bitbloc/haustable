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
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0e0f0a] text-white font-[var(--font-body)] selection:bg-[var(--color-brand)] selection:text-black">
      
      {/* 1. WebGL Background Layer (Reeded Glass Effect with Ambient Dark Vignette) */}
      <div className="fixed inset-0 z-0 bg-[#0e0f0a] pointer-events-none">
        <ReededGlassBackground imageUrl={finalBg} />
        {/* Smooth Dark Gradient for Readability & High Contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/90 pointer-events-none z-10" />
      </div>

      {/* 2. Content Container (Breathable Centered Column) */}
      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen w-full max-w-xl mx-auto px-4 sm:px-6 pt-12 pb-28">
        {children}
      </div>

    </div>
  );
}

