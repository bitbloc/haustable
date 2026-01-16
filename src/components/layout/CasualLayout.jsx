import { motion } from 'framer-motion';

export default function CasualLayout({ children, backgroundImage }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white font-sans selection:bg-[#DFFF00] selection:text-black">
      
      {/* 1. Background Layer */}
      <div className="absolute inset-0 z-0">
        <motion.img 
            key={backgroundImage} // Force re-render on change
            src={backgroundImage || "/assets/background-mood.png"}
            alt="Ambience"
            className="w-full h-full object-cover opacity-60"
            initial={{ scale: 1 }}
            animate={{ scale: 1.1 }}
            transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/30" />
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
