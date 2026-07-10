
import React from 'react'
import TableManager from '../components/shared/TableManager'

export default function AdminTableManager() {
    return (
        <div className="flex flex-col h-[calc(100vh-100px)] p-6 font-sans">
            <div className="mb-4">
                <h1 className="text-xl font-bold font-mono tracking-wider text-[#1A1A1A] uppercase">Table Manager</h1>
                <p className="text-[10px] text-[#767673] font-mono font-bold uppercase tracking-tight mt-0.5">Block tables for walk-ins or manage availability manually.</p>
            </div>
            
            <div className="flex-1 bg-white rounded-xl border border-[#D1D1CD] overflow-hidden shadow-sm">
                 <TableManager isStaffView={false} />
            </div>
        </div>
    )
}
