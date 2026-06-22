import KineticText from '../KineticText'

export default function HomeHeader({ t, status }) {
    return (
        <div className="flex flex-col items-start text-left mt-8 mb-4 w-full">
            {/* Secondary Logo (New) */}
            <div className="w-20 md:w-28 mb-[-5px] z-10">
                <img 
                    src="/logo-secondary.png" 
                    alt="Secondary Logo" 
                    className="w-full h-auto object-contain drop-shadow-md opacity-90"
                />
            </div>

            {/* Logo Image */}
            <div className="w-full max-w-[280px] md:max-w-[340px] pr-8 py-3 pl-0">
                <img 
                    src="/assets/logo-script.webp" 
                    alt="HAUS TABLE" 
                    className="w-full h-auto object-contain drop-shadow-xl"
                />
            </div>
            
            {/* Status Indicator */}
            <div className="flex items-center gap-2.5 mt-2 font-[var(--font-outlier)]">
                <div className={`relative flex items-center justify-center w-2.5 h-2.5 rounded-full ${status.isOpen ? 'bg-[var(--color-brand)] shadow-[0_0_8px_var(--color-brand)]' : 'bg-[var(--color-accent-red)]'}`}>
                    {status.isOpen && <div className="absolute inset-0 bg-[var(--color-brand)] rounded-full animate-ping opacity-75" />}
                </div>
                <span className={`text-xs font-bold tracking-[0.25em] ${status.isOpen ? 'text-[var(--color-brand)]' : 'text-[var(--color-accent-red)]'}`}>
                    {status.isOpen ? "OPEN NOW" : "CLOSED"}
                </span>
            </div>
        </div>
    )
}
