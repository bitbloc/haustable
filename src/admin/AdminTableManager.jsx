
import React from 'react'
import TableManager from '../components/shared/TableManager'

export default function AdminTableManager() {
    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white tracking-tight">Table Manager</h1>
                <p className="text-gray-500 mt-1">Block tables for walk-ins or manage availability manually.</p>
            </div>
            
            <div className="flex-1 bg-[#1a1a1a] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
                 <TableManager isStaffView={false} />
            </div>
        </div>
    )
}
