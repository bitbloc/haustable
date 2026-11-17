import React from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'

export default function PublicLayout({ session }) {
    return (
        <div className="flex flex-col min-h-screen bg-canvas font-sans text-ink">
            <Header session={session} />

            {/* Content */}
            <div className="flex-1">
                <Outlet />
            </div>

            {/* Footer */}
            <footer className="py-8 text-center border-t border-[var(--color-rule)] bg-paper mt-auto">
                <div className="flex flex-col items-center gap-1">
                    <p className="text-[10px] font-bold text-ink uppercase tracking-[0.2em]">
                        on haus table <span className="text-subInk font-normal">by in the haus</span>
                    </p>
                    <p className="text-[10px] text-subInk font-mono">
                        Last updated: {new Date().toLocaleDateString('en-GB')}
                    </p>
                </div>
            </footer>
        </div>
    )
}
