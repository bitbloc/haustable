import { motion, AnimatePresence } from 'framer-motion';

export default function CasualLayout({ children, backgroundImage }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white font-sans selection:bg-[#DFFF00] selection:text-black">
      
      {/* 1. Background Layer */}
      <div className="absolute inset-0 z-0 bg-black">
        <AnimatePresence mode="popLayout">
            {backgroundImage && (
                <motion.img 
                    key={backgroundImage} 
                    src={backgroundImage}
                    alt="Ambience"
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, scale: 1.05 }}
                    exit={{ opacity: 0 }}
                    transition={{ 
                        opacity: { duration: 1.5 },
                        scale: { duration: 20, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
                    }}
                />
            )}
        </AnimatePresence>
        
        {/* Reeded Glass Effect (Displacement / Vertical Stripes) */}
        <div className="absolute inset-0 pointer-events-none z-1 overflow-hidden mix-blend-overlay opacity-30">
             <motion.div 
                className="w-[110%] h-full -ml-[5%]"
                animate={{ x: ["-2%", "2%", "-1%"] }}
                transition={{ duration: 15, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                style={{
                    backgroundImage: "linear-gradient(90deg, transparent 0px, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)",
                    backgroundSize: "6px 100%"
                }}
             />
        </div>
        
        {/* Glass Distortion Map (SVG Filter for realism) - Optional but requested "Displacement Map" */}
        {/* We will stick to the CSS Striped Overlay + Blur first as proper Displacement maps in React can be heavy/tricky without SVG ref */}
        
        {/* Gradient Overlay for Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/30 pointer-events-none z-2" />
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
