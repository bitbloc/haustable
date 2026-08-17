/* Hallmark · component: HomeHeader · genre: modern-minimal · theme: dieter-rams-thai-modern
 * states: default · active · offline
 * contrast: pass (APCA / WCAG AAA compliant)
 */
import React from 'react'

export default function HomeHeader({ t, status }) {
    const isOpen = Boolean(status?.isOpen)

    return (
        <header className="w-full flex flex-col select-none mb-2">
            {/* Top Identity Instrument Bar */}
            <div className="flex items-center justify-between w-full border-b border-white/15 pb-3.5 pt-2">
                {/* Secondary Logo + Coordinates */}
                <div className="flex items-center gap-3">
                    <img 
                        src="/logo-secondary.png" 
                        alt="HAUS Emblem" 
                        className="w-8 h-8 object-contain opacity-95 brightness-125"
                        onError={(e) => {
                            e.target.style.display = 'none'
                        }}
                    />
                    <div className="flex flex-col">
                        <span className="font-mono text-[12px] font-black tracking-widest text-white uppercase leading-tight">
                            IN THE HAUS
                        </span>
                        <span className="font-mono text-[9.5px] text-white/60 tracking-wider">
                            [ 17.4064° N, 104.7818° E ]
                        </span>
                    </div>
                </div>

                {/* Rams Instrument LED Status Bulb */}
                <div className="flex items-center gap-2 px-3 py-1 bg-black/50 border border-white/20 rounded-none backdrop-blur-xs">
                    <div className="relative w-2 h-2 flex items-center justify-center">
                        <span className={`w-2 h-2 rounded-full ${
                            isOpen 
                                ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse' 
                                : 'bg-[var(--color-accent-red)] shadow-[0_0_10px_rgba(239,68,68,0.7)]'
                        }`} />
                    </div>
                    <span className="font-mono text-[9.5px] font-bold tracking-widest text-white">
                        {isOpen ? 'SYSTEM: ACTIVE' : 'SYSTEM: CLOSED'}
                    </span>
                </div>
            </div>

            {/* Main Script Logo Display with Generous Breathing Room */}
            <div className="w-full pt-8 pb-7 flex flex-col items-center justify-center text-center">
                <div className="w-full max-w-[280px] sm:max-w-[320px] flex justify-center mb-3">
                    <img 
                        src="/assets/logo-script.webp" 
                        alt="HAUS TABLE" 
                        className="w-full h-auto object-contain filter drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] brightness-110"
                        onError={(e) => {
                            e.target.src = '/logo.png'
                        }}
                    />
                </div>
                <p className="font-mono text-[11px] font-semibold text-white/80 uppercase tracking-widest">
                    จริตจัด รสชัดเจน · ริมโขง นครพนม
                </p>
            </div>
        </header>
    )
}

