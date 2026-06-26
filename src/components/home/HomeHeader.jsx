import React from 'react'

export default function HomeHeader({ t, status }) {
    return (
        <div className="w-full flex flex-col gap-4">
            {/* Top Identity Block */}
            <div className="flex items-end justify-between w-full border-b border-[var(--color-hallmark-rule)] pb-3">
                <div className="flex flex-col items-start gap-1">
                    {/* Secondary Logo + Title */}
                    <div className="flex items-center gap-3">
                        <img 
                            src="/logo-secondary.png" 
                            alt="Secondary Logo" 
                            className="w-8 h-8 object-contain opacity-95 filter invert dark:invert-0"
                        />
                        <div className="flex flex-col">
                            <span className="font-mono text-[10px] font-bold tracking-wider text-white uppercase">
                                HAUS TABLE
                            </span>
                            <span className="font-mono text-[8px] text-white/60 tracking-widest">
                                [ 17.4064° N, 104.7818° E ]
                            </span>
                        </div>
                    </div>
                </div>

                {/* Braun-style Instrument LED Status Bulb */}
                <div className="flex items-center gap-2 px-3 py-1 bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] rounded-full shadow-sm">
                    <div className="relative w-2 h-2 flex items-center justify-center">
                        <span className={`absolute inset-0 rounded-full ${
                            status.isOpen 
                                ? 'bg-emerald-500 shadow-[0_0_8px_oklch(64%_0.22_140)] animate-pulse' 
                                : 'bg-red-500 shadow-[0_0_8px_oklch(62%_0.22_25)]'
                        }`} />
                    </div>
                    <span className="font-mono text-[9px] font-bold tracking-widest text-[var(--color-hallmark-ink)]">
                        {status.isOpen ? 'SYSTEM: ACTIVE' : 'SYSTEM: OFFLINE'}
                    </span>
                </div>
            </div>

            {/* Main Script Logo Display */}
            <div className="w-full py-2 flex items-center justify-center">
                <div className="w-full max-w-[280px] flex justify-center">
                    <img 
                        src="/assets/logo-script.webp" 
                        alt="HAUS TABLE" 
                        className="w-full h-auto object-contain filter drop-shadow-[0_2px_10px_rgba(0,0,0,0.15)] opacity-95"
                    />
                </div>
            </div>
        </div>
    )
}
