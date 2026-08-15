/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react'
import TableManager from '../components/shared/TableManager'
import AdminTableEditor from '../AdminTableEditor'
import { LayoutGrid, Move, QrCode } from 'lucide-react'

export default function AdminTableManager({ defaultTab = 'live' }) {
    const [activeTab, setActiveTab] = useState(defaultTab) // 'live' | 'editor'

    return (
        <div className="flex flex-col min-h-[calc(100vh-140px)] font-sans pb-12">
            {/* Header & Sub-Tab Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[oklch(85%_0.012_28)]">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] bg-[oklch(94%_0.02_28)] px-2 py-0.5 rounded-sm">
                            FLOOR & TABLE HUB
                        </span>
                    </div>
                    <h1 className="font-mono text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)] uppercase mt-1">
                        Floor & Tables
                    </h1>
                    <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                        Manage live table availability, guest seating, floorplan geometry & table QR codes
                    </p>
                </div>

                {/* Sub-tab Switcher */}
                <div className="flex bg-[oklch(94%_0.010_28)] p-1 rounded-sm border border-[oklch(85%_0.012_28)] font-mono text-xs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('live')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-sm font-bold uppercase tracking-wider transition-all ${
                            activeTab === 'live'
                                ? 'bg-[oklch(18%_0.012_28)] text-white shadow-sm'
                                : 'text-[oklch(42%_0.010_28)] hover:text-black'
                        }`}
                    >
                        <LayoutGrid size={14} />
                        <span>Live Operations</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('editor')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-sm font-bold uppercase tracking-wider transition-all ${
                            activeTab === 'editor'
                                ? 'bg-[oklch(18%_0.012_28)] text-white shadow-sm'
                                : 'text-[oklch(42%_0.010_28)] hover:text-black'
                        }`}
                    >
                        <Move size={14} />
                        <span>Layout & QR Studio</span>
                    </button>
                </div>
            </div>

            {/* Tab Body */}
            <div className="flex-1 bg-[oklch(98%_0.006_28)] rounded-sm border border-[oklch(85%_0.012_28)] overflow-hidden">
                {activeTab === 'live' ? (
                    <TableManager isStaffView={false} />
                ) : (
                    <AdminTableEditor />
                )}
            </div>
        </div>
    )
}
