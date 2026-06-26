import { motion } from 'framer-motion';
import ReededGlassBackground from './ReededGlassBackground';

export default function CasualLayout({ children, backgroundImage }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[var(--color-hallmark-paper-dark)] text-white font-[var(--font-body)] selection:bg-[var(--color-brand)] selection:text-black">
      
      {/* 1. WebGL Background Layer (Reeded Glass Effect) */}
      <div className="absolute inset-0 z-0 bg-[var(--color-hallmark-paper-dark)]">
         <ReededGlassBackground imageUrl={backgroundImage} />
        
        {/* Gradient Overlay for Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-hallmark-paper-dark)] via-[var(--color-hallmark-paper-dark)]/50 to-[var(--color-hallmark-paper-dark)]/30 pointer-events-none z-10" />
      </div>

      {/* 2. Content Container (Asymmetric & Left-Biased) */}
      <div className="relative z-10 flex flex-col items-start justify-center min-h-screen p-6 md:p-16 w-full max-w-lg md:max-w-xl mx-auto md:mx-0 md:ml-32">
        <div className="w-full flex flex-col items-start gap-8">
            {children}
        </div>
      </div>

    </div>
  );
}
