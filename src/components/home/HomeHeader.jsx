import KineticText from '../KineticText'

export default function HomeHeader({ t, status }) {
    return (
        <div className="flex flex-col items-center mt-12 mb-4">
            <KineticText 
                text={(t('headline') || "HAUS TABLE").toUpperCase()} 
                className="text-6xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 tracking-tighter"
            />
            
            {/* Status Badge */}
            <div className={`mt-6 px-6 py-2 rounded-full border border-white/20 backdrop-blur-md flex items-center gap-3 ${status.isOpen ? 'bg-[#DFFF00]/10 text-[#DFFF00]' : 'bg-red-500/10 text-red-500'}`}>
                <div className={`w-2 h-2 rounded-full ${status.isOpen ? 'bg-[#DFFF00] animate-pulse' : 'bg-red-500'}`} />
                <span className="font-mono text-lg tracking-widest font-bold">{status.text}</span>
            </div>
        </div>
    )
}
