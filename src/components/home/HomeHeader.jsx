import KineticText from '../KineticText'

export default function HomeHeader({ t, status }) {
    return (
        <div className="flex flex-col items-center mt-12 mb-4">
            {/* Logo Image */}
            <div className="w-full max-w-[280px] md:max-w-[400px] px-8 py-4">
                <img 
                    src="/assets/logo-script.png" 
                    alt="HAUS TABLE" 
                    className="w-full h-auto object-contain drop-shadow-xl"
                />
            </div>
            
            {/* Status Indicator */}
            <div className="flex items-center gap-3">
                <div className={`relative flex items-center justify-center w-3 h-3 rounded-full ${status.isOpen ? 'bg-[#DFFF00] shadow-[0_0_10px_#DFFF00]' : 'bg-red-500'}`}>
                    {status.isOpen && <div className="absolute inset-0 bg-[#DFFF00] rounded-full animate-ping opacity-75" />}
                </div>
                <span className={`text-sm font-bold tracking-[0.2em] ${status.isOpen ? 'text-[#DFFF00]' : 'text-red-500'}`}>
                    {status.isOpen ? "OPEN NOW" : "CLOSED"}
                </span>
            </div>
        </div>
    )
}
