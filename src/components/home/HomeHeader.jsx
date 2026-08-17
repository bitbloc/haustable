/* Hallmark · component: HomeHeader · genre: modern-minimal · theme: dieter-rams-thai-modern
 * states: default · active · offline
 * contrast: pass (APCA / WCAG AAA compliant)
 */
import React from 'react'

export default function HomeHeader({ t, status }) {
    const isOpen = Boolean(status?.isOpen)

    return (
        <header className="w-full flex flex-col select-none">
            {/* Top Identity Instrument Bar */}
            <div className="flex items-center justify-between w-full border-b border-[var(--color-hallmark-rule)] pb-3 pt-1">
                {/* Secondary Logo + Coordinates */}
                <div className="flex items-center gap-3">
                    <img 
                        src="/logo-secondary.png" 
                        alt="HAUS Emblem" 
                        className="w-8 h-8 object-contain opacity-90 brightness-110"
                        onError={(e) => {
                            e.target.style.display = 'none'
                        }}
                    />
                    <div className="flex flex-col">
                        <span className="font-mono text-[11px] font-black tracking-widest text-[var(--color-hallmark-ink)] uppercase leading-tight">
                            IN THE HAUS
                        </span>
                        <span className="font-mono text-[9px] text-[var(--color-hallmark-ink-muted)] tracking-wider">
                            [ 17.4064° N, 104.7818° E ]
                        </span>
                    </div>
                </div>

                {/* Rams Instrument LED Status Bulb */}
                <div className="flex items-center gap-2 px-2.5 py-1 bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-none">
                    <div className="relative w-2 h-2 flex items-center justify-center">
                        <span className={`w-2 h-2 rounded-full ${
                            isOpen 
                                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse' 
                                : 'bg-[var(--color-accent-red)] shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                        }`} />
                    </div>
                    <span className="font-mono text-[9px] font-bold tracking-widest text-[var(--color-hallmark-ink)]">
                        {isOpen ? 'SYSTEM: ACTIVE' : 'SYSTEM: CLOSED'}
                    </span>
                </div>
            </div>

            {/* Main Script Logo Display */}
            <div className="w-full pt-6 pb-6 flex flex-col items-center justify-center text-center">
                <div className="w-full max-w-[240px] flex justify-center mb-2">
                    <img 
                        src="/assets/logo-script.webp" 
                        alt="HAUS TABLE" 
                        className="w-full h-auto object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.12)] opacity-95"
                        onError={(e) => {
                            e.target.src = '/logo.png'
                        }}
                    />
                </div>
                <p className="font-mono text-[10px] font-bold text-[var(--color-hallmark-ink-muted)] uppercase tracking-widest">
                    จริตจัด รสชัดเจน · ริมโขง นครพนม
                </p>
            </div>
        </header>
    )
}
