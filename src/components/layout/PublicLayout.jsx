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
                <div className="flex flex-col items-center gap-1 leading-normal">
                    <p className="text-sm font-bold text-ink">
                        ร้านในบ้าน นครพนม <span className="text-[var(--color-muted)] font-normal">In the haus</span>
                    </p>
                    <p className="text-sm text-[var(--color-muted)]">
                        โทร <a href="tel:0985284217" className="font-mono underline text-ink">098-528-4217</a>
                    </p>
                </div>
            </footer>
        </div>
    )
}
