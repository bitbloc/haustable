/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'

export default function LivePulseMetrics({
    revenueToday = 0,
    completedOrdersCount = 0,
    totalTables = 0,
    occupiedTables = 0,
    totalGuests = 0,
    pendingInboxCount = 0,
    dineInCount = 0,
    pickupCount = 0,
    paymentBreakdown = null,
    loading = false
}) {
    const occupancyRate = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            {/* 1. Today's Revenue */}
            <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-3.5 md:p-4 rounded-sm flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)]">
                        TODAY'S REVENUE
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_140)] animate-pulse" />
                </div>
                
                <div className="my-2">
                    <div className="font-mono tabular-nums text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-[oklch(18%_0.012_28)]">
                        {loading ? '...' : `฿${Number(revenueToday || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                    </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-[oklch(55%_0.010_28)] border-t border-[oklch(88%_0.008_28)] pt-2 mt-1">
                    <span className="tabular-nums">{completedOrdersCount} PAID ORDERS</span>
                    <span className="text-[oklch(45%_0.08_140)] font-bold tracking-wider text-[10px]">LIVE SYNC</span>
                </div>
            </div>

            {/* 2. Table Occupancy */}
            <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-3.5 md:p-4 rounded-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)]">
                        TABLE OCCUPANCY
                    </span>
                    <span className="font-mono tabular-nums text-[11px] font-bold text-[oklch(18%_0.012_28)] bg-[oklch(92%_0.012_28)] px-1.5 py-0.5 rounded-sm">
                        {occupancyRate}%
                    </span>
                </div>

                <div className="my-2 flex items-baseline gap-2">
                    <div className="font-mono tabular-nums text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-[oklch(18%_0.012_28)]">
                        {occupiedTables} <span className="text-sm md:text-base font-normal text-[oklch(55%_0.010_28)]">/ {totalTables} TABLES</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[oklch(90%_0.010_28)] h-1.5 rounded-full overflow-hidden mt-1 mb-2">
                    <div 
                        className={`h-full transition-all duration-500 ${occupancyRate > 80 ? 'bg-[oklch(52%_0.16_28)]' : 'bg-[oklch(45%_0.08_140)]'}`}
                        style={{ width: `${Math.min(100, occupancyRate)}%` }}
                    />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-[oklch(55%_0.010_28)] border-t border-[oklch(88%_0.008_28)] pt-2">
                    <span className="tabular-nums">{totalGuests} GUESTS SEATED</span>
                    <span className="tabular-nums">{totalTables - occupiedTables} FREE</span>
                </div>
            </div>

            {/* 3. Active Order Channels */}
            <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-3.5 md:p-4 rounded-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)]">
                        ACTIVE SERVICE MIX
                    </span>
                    <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)] font-bold">[CHANNELS]</span>
                </div>

                <div className="my-2 grid grid-cols-2 gap-1.5 text-center font-mono">
                    <div className="bg-[oklch(94%_0.010_28)] p-1.5 rounded-sm">
                        <div className="text-xs md:text-sm font-bold text-[oklch(18%_0.012_28)] tabular-nums">{dineInCount}</div>
                        <div className="text-[9px] text-[oklch(50%_0.010_28)] uppercase tracking-wider">DINE-IN</div>
                    </div>
                    <div className="bg-[oklch(94%_0.010_28)] p-1.5 rounded-sm">
                        <div className="text-xs md:text-sm font-bold text-[oklch(18%_0.012_28)] tabular-nums">{pickupCount}</div>
                        <div className="text-[9px] text-[oklch(50%_0.010_28)] uppercase tracking-wider">PICKUP</div>
                    </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-[oklch(55%_0.010_28)] border-t border-[oklch(88%_0.008_28)] pt-2 mt-1">
                    <span>TOTAL ACTIVE</span>
                    <span className="font-bold text-[oklch(18%_0.012_28)] tabular-nums">{dineInCount + pickupCount} ORDERS</span>
                </div>
            </div>

            {/* 4. Pending Inbox Alert */}
            <div className={`border p-3.5 md:p-4 rounded-sm flex flex-col justify-between transition-colors ${
                pendingInboxCount > 0 
                    ? 'bg-[oklch(96%_0.03_28)] border-[oklch(52%_0.16_28)]' 
                    : 'bg-[oklch(98%_0.006_28)] border-[oklch(85%_0.012_28)]'
            }`}>
                <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)]">
                        ACTION REQUIRED
                    </span>
                    {pendingInboxCount > 0 ? (
                        <span className="flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[oklch(52%_0.16_28)] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[oklch(52%_0.16_28)]"></span>
                        </span>
                    ) : (
                        <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_140)]" />
                    )}
                </div>

                <div className="my-2 flex items-baseline gap-2">
                    <div className={`font-mono tabular-nums text-xl md:text-2xl lg:text-3xl font-bold tracking-tight ${
                        pendingInboxCount > 0 ? 'text-[oklch(52%_0.16_28)]' : 'text-[oklch(18%_0.012_28)]'
                    }`}>
                        {pendingInboxCount}
                    </div>
                    <span className="font-mono text-xs text-[oklch(55%_0.010_28)]">SLIPS PENDING</span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-[oklch(55%_0.010_28)] border-t border-[oklch(88%_0.008_28)] pt-2 mt-1">
                    <span>{pendingInboxCount > 0 ? 'NEEDS APPROVAL' : 'ALL CAUGHT UP'}</span>
                    <span className="font-bold tracking-wider text-[10px]">{pendingInboxCount > 0 ? 'URGENT' : 'READY'}</span>
                </div>
            </div>

            {/* Payment Method Quick Breakdown Strip */}
            {paymentBreakdown && (
                <div className="col-span-2 lg:col-span-4 bg-[oklch(96%_0.008_28)] border border-[oklch(85%_0.012_28)] p-2.5 rounded-sm flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                    <span className="text-[oklch(42%_0.010_28)] font-bold uppercase tracking-wider text-[10px]">
                        PAYMENT METHOD BREAKDOWN:
                    </span>
                    <div className="flex items-center gap-3 flex-wrap text-[11px]">
                        <span className="text-[oklch(28%_0.10_65)] font-bold bg-[oklch(93%_0.04_65)] px-2 py-0.5 rounded-xs border border-[oklch(80%_0.06_65)] tabular-nums">
                            เงินสด: ฿{(paymentBreakdown.cash || 0).toLocaleString()}
                        </span>
                        <span className="text-[oklch(28%_0.08_140)] font-bold bg-[oklch(93%_0.04_140)] px-2 py-0.5 rounded-xs border border-[oklch(80%_0.06_140)] tabular-nums">
                            PromptPay QR: ฿{(paymentBreakdown.qr || 0).toLocaleString()}
                        </span>
                        <span className="text-[oklch(28%_0.08_250)] font-bold bg-[oklch(93%_0.04_250)] px-2 py-0.5 rounded-xs border border-[oklch(80%_0.06_250)] tabular-nums">
                            บัตรเครดิต: ฿{(paymentBreakdown.credit || 0).toLocaleString()}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
