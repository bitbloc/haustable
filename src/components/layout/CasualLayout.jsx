import { motion, AnimatePresence } from 'framer-motion';

export default function CasualLayout({ children, backgroundImage }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white font-sans selection:bg-[#DFFF00] selection:text-black">
      
      {/* 1. Background Layer */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="popLayout">
            <motion.img 
                key={backgroundImage || "default-bg"} 
                src={backgroundImage || "/assets/background-mood.png"}
                alt="Ambience"
                className="absolute inset-0 w-full h-full object-cover opacity-60"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ 
                    opacity: { duration: 1.2 }, 
                    scale: { duration: 20, repeat: Infinity, repeatType: "reverse", ease: "linear" } 
                }}
            />
        </AnimatePresence>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/30 pointer-events-none" />
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
