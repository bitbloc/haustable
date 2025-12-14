import React from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'

export default function PublicLayout({ session }) {
    return (
        <div className="flex flex-col min-h-screen bg-[#F4F4F4] font-sans text-[#111]">
            <Header session={session} />

            {/* Content */}
            <div className="flex-1">
                <Outlet />
            </div>

            {/* Footer */}
            <footer className="py-8 text-center border-t border-gray-200 bg-[#FAFAFA] mt-auto">
                <div className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                    <p className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em]">
                        on haus table <span className="text-gray-400 font-normal">by in the haus</span>
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">
                        Last updated: {new Date().toLocaleDateString('en-GB')}
                    </p>
                </div>
            </footer>
        </div>
    )
}
