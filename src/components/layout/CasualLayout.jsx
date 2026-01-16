import { motion } from 'framer-motion';
import ReededGlassBackground from './ReededGlassBackground';

export default function CasualLayout({ children, backgroundImage }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white font-sans selection:bg-[#DFFF00] selection:text-black">
      
      {/* 1. WebGL Background Layer (Reeded Glass Effect) */}
      <div className="absolute inset-0 z-0 bg-black">
         <ReededGlassBackground imageUrl={backgroundImage} />
        
        {/* Gradient Overlay for Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/30 pointer-events-none z-10" />
      </div>

      {/* 2. Content Container (Center & Glass) */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 md:p-8">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-8">
            {children}
        </div>
      </div>

    </div>
  );
}
