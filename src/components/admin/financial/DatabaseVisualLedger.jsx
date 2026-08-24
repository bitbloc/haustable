/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react'
import { formatThaiTimeOnly } from '../../../utils/timeUtils'
import { toast } from 'sonner'

export default function DatabaseVisualLedger({ rawTransactions = [], timeRangeLabel = '' }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [paymentFilter, setPaymentFilter] = useState('all') // all, cash, qr, credit, split
    const [channelFilter, setChannelFilter] = useState('all') // all, dine_in, pickup
    const [expandedRowIds, setExpandedRowIds] = useState(new Set())
    const [copiedId, setCopiedId] = useState(null)

    const toggleRow = (id) => {
        setExpandedRowIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const expandAll = () => {
        setExpandedRowIds(new Set(filteredTransactions.map(t => t.id)))
    }

    const collapseAll = () => {
        setExpandedRowIds(new Set())
    }

    const handleCopyId = (id) => {
        navigator.clipboard.writeText(id)
        setCopiedId(id)
        toast.success(`คัดลอก Transaction ID: ${id.slice(0, 8)}... แล้ว`)
        setTimeout(() => setCopiedId(null), 2000)
    }

    // Filter transactions
    const filteredTransactions = useMemo(() => {
        return (rawTransactions || []).filter(tx => {
            // Payment Filter
            if (paymentFilter !== 'all') {
                const method = (tx.paymentMethod || '').toLowerCase()
                if (paymentFilter === 'cash' && method !== 'cash') return false
                if (paymentFilter === 'qr' && !method.includes('qr') && !method.includes('promptpay') && !method.includes('transfer')) return false
                if (paymentFilter === 'credit' && !method.includes('credit') && !method.includes('card')) return false
                if (paymentFilter === 'split' && !method.includes('split') && !tx.isSplit) return false
            }

            // Channel Filter
            if (channelFilter !== 'all') {
                const type = (tx.booking_type || 'dine_in').toLowerCase()
                if (channelFilter === 'dine_in' && !(type === 'dine_in' || type === 'walk_in')) return false
                if (channelFilter === 'pickup' && !type.includes('pickup') && !type.includes('takeaway')) return false
            }

            // Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const id = String(tx.id || '').toLowerCase()
                const shortId = id.slice(0, 8)
                const table = (tx.tableName || '').toLowerCase()
                const guest = (tx.guestName || '').toLowerCase()
                const remark = (tx.staff_remark || '').toLowerCase()
                const itemsStr = (tx.items || []).map(i => i.name.toLowerCase()).join(' ')

                return id.includes(q) || shortId.includes(q) || table.includes(q) || guest.includes(q) || remark.includes(q) || itemsStr.includes(q)
            }

            return true
        })
    }, [rawTransactions, paymentFilter, channelFilter, searchQuery])

    const totalFilteredAmount = filteredTransactions.reduce((sum, tx) => sum + (parseFloat(tx.total_amount) || 0), 0)

    const handleExportCSV = () => {
        if (filteredTransactions.length === 0) {
            toast.error('ไม่มีข้อมูลสำหรับส่งออก CSV')
            return
        }

        const headers = ['Transaction ID', 'Time', 'Channel', 'Table', 'Guest', 'Pax', 'Payment Method', 'Total Amount', 'Items Count', 'Status']
        const rows = filteredTransactions.map(tx => [
            tx.id,
            formatThaiTimeOnly(tx.booking_time),
            tx.booking_type === 'pickup' ? 'Takeaway' : 'Dine-In',
            tx.tableName || '-',
            `"${(tx.guestName || 'Guest').replace(/"/g, '""')}"`,
            tx.pax || 1,
            tx.paymentMethodLabel || 'Cash',
            tx.total_amount || 0,
            tx.items?.length || 0,
            tx.status
        ])

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `financial-ledger-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success(`ส่งออก ${filteredTransactions.length} รายการเป็นไฟล์ CSV เรียบร้อย`)
    }

    return (
        <div className="space-y-4 font-sans text-[oklch(18%_0.012_28)]">
            
            {/* 1. Header Toolbar & Filters Matrix */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] divide-y divide-[oklch(85%_0.012_28)]">
                
                {/* Header Row */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[oklch(97%_0.008_28)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                                LEDGER // STREAM
                            </span>
                            <h3 className="font-bold text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                                สมุดบัญชีธุรกรรมฐานข้อมูลจริง (Database Visual Ledger)
                            </h3>
                        </div>
                        <p className="text-xs font-mono text-[oklch(42%_0.010_28)] mt-0.5">
                            บันทึกธุรกรรมละเอียด ตรวจสอบรายการย้อนหลังระดับบิล ({timeRangeLabel})
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={handleExportCSV}
                            className="px-3 py-1.5 bg-[oklch(97%_0.008_28)] hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs font-bold transition-all"
                        >
                            <span>EXPORT CSV ({filteredTransactions.length})</span>
                        </button>
                        <span className="px-2.5 py-1 bg-[oklch(97%_0.008_28)] border border-[oklch(45%_0.08_140)]/40 font-mono text-[11px] text-[oklch(45%_0.08_140)] font-bold">
                            LIVE POS SYNC
                        </span>
                    </div>
                </div>

                {/* Filter Matrix Controls */}
                <div className="p-3 bg-[oklch(97%_0.008_28)] flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-xs">
                    
                    {/* Search Input */}
                    <div className="flex-1 max-w-md">
                        <input
                            type="text"
                            placeholder="ค้นหา ID, โต๊ะ, ลูกค้า, หรือเมนู…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)] placeholder:text-[oklch(55%_0.010_28)]"
                        />
                    </div>

                    {/* Payment Method Pills */}
                    <div className="inline-flex border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)] overflow-x-auto no-scrollbar">
                        {[
                            { id: 'all', label: 'ทั้งหมด' },
                            { id: 'qr', label: 'QR' },
                            { id: 'cash', label: 'เงินสด' },
                            { id: 'credit', label: 'บัตร' },
                            { id: 'split', label: 'Split' },
                        ].map(btn => (
                            <button
                                key={btn.id}
                                onClick={() => setPaymentFilter(btn.id)}
                                className={`px-2.5 py-1.5 font-bold transition-colors whitespace-nowrap ${
                                    paymentFilter === btn.id
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                        : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(97%_0.008_28)]'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {/* Channel Pills */}
                    <div className="inline-flex border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)] overflow-x-auto no-scrollbar">
                        {[
                            { id: 'all', label: 'ทุกช่องทาง' },
                            { id: 'dine_in', label: 'ทานที่ร้าน' },
                            { id: 'pickup', label: 'Takeaway' },
                        ].map(btn => (
                            <button
                                key={btn.id}
                                onClick={() => setChannelFilter(btn.id)}
                                className={`px-2.5 py-1.5 font-bold transition-colors whitespace-nowrap ${
                                    channelFilter === btn.id
                                        ? 'bg-[oklch(52%_0.16_28)] text-white'
                                        : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(97%_0.008_28)]'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Ledger Quick Summary Row */}
                <div className="px-4 py-2 bg-[oklch(94%_0.010_28)] flex items-center justify-between font-mono text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                        <span className="text-[oklch(42%_0.010_28)]">
                            ผลลัพธ์: <strong className="text-[oklch(18%_0.012_28)] font-bold">{filteredTransactions.length}</strong> รายการ
                        </span>
                        <span className="text-[oklch(42%_0.010_28)]">
                            ยอดรวมคัดกรอง: <strong className="text-[oklch(52%_0.16_28)] font-bold tabular-nums">฿{totalFilteredAmount.toLocaleString()}</strong>
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={expandAll}
                            className="text-[11px] font-bold text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] underline"
                        >
                            ขยายดูเมนูทั้งหมด
                        </button>
                        <span className="text-[oklch(85%_0.012_28)]">|</span>
                        <button
                            onClick={collapseAll}
                            className="text-[11px] font-bold text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] underline"
                        >
                            ย่อทั้งหมด
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Visual Ledger Data Table */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs min-w-[760px]">
                        <thead>
                            <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] text-[11px] font-bold uppercase tracking-wider">
                                <th className="p-3 border-r border-[oklch(85%_0.012_28)]">TIME / TX ID</th>
                                <th className="p-3 border-r border-[oklch(85%_0.012_28)]">TABLE / CHANNEL</th>
                                <th className="p-3 border-r border-[oklch(85%_0.012_28)]">GUEST / MEMBER</th>
                                <th className="p-3 border-r border-[oklch(85%_0.012_28)] text-center">PAX</th>
                                <th className="p-3 border-r border-[oklch(85%_0.012_28)]">ITEMS AUDIT</th>
                                <th className="p-3 border-r border-[oklch(85%_0.012_28)]">PAYMENT</th>
                                <th className="p-3 text-right border-r border-[oklch(85%_0.012_28)]">TOTAL</th>
                                <th className="p-3 text-center">ACTION</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="p-8 text-center text-[oklch(42%_0.010_28)] font-sans">
                                        <p className="font-bold text-sm text-[oklch(18%_0.012_28)]">ไม่พบรายการธุรกรรมตามเงื่อนไข</p>
                                        <p className="text-xs text-[oklch(42%_0.010_28)] mt-0.5">ลองปรับคำค้นหาหรือเปลี่ยนตัวกรองชำระเงิน</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((tx) => {
                                    const isExpanded = expandedRowIds.has(tx.id)
                                    const isDineIn = tx.booking_type !== 'pickup'

                                    return (
                                        <React.Fragment key={tx.id}>
                                            <tr className="hover:bg-[oklch(94%_0.010_28)] transition-colors">
                                                
                                                {/* Time / TX ID */}
                                                <td className="p-3 border-r border-[oklch(85%_0.012_28)]">
                                                    <div className="font-bold text-sm text-[oklch(18%_0.012_28)]">
                                                        {formatThaiTimeOnly(tx.booking_time)}
                                                    </div>
                                                    <button
                                                        onClick={() => handleCopyId(tx.id)}
                                                        className="text-[10px] text-[oklch(42%_0.010_28)] hover:text-[oklch(52%_0.16_28)] font-mono block mt-0.5 hover:underline"
                                                        title="Click to copy full UUID"
                                                    >
                                                        #{tx.id.slice(0, 8)} {copiedId === tx.id ? '[COPIED]' : ''}
                                                    </button>
                                                </td>

                                                {/* Table / Channel */}
                                                <td className="p-3 border-r border-[oklch(85%_0.012_28)]">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-xs px-2 py-0.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                                                            {tx.tableName || (isDineIn ? 'WALK-IN' : 'PICKUP')}
                                                        </span>
                                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)]">
                                                            {isDineIn ? 'DINE-IN' : 'PICKUP'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Guest / Member */}
                                                <td className="p-3 border-r border-[oklch(85%_0.012_28)] font-sans">
                                                    <div className="font-bold text-xs text-[oklch(18%_0.012_28)]">
                                                        {tx.guestName || 'Guest'}
                                                    </div>
                                                    {tx.memberTier && (
                                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(52%_0.16_28)] inline-block mt-0.5">
                                                            TIER: {tx.memberTier}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Pax */}
                                                <td className="p-3 text-center border-r border-[oklch(85%_0.012_28)] font-bold tabular-nums">
                                                    {tx.pax || 1}
                                                </td>

                                                {/* Items Audit */}
                                                <td className="p-3 border-r border-[oklch(85%_0.012_28)]">
                                                    <button
                                                        onClick={() => toggleRow(tx.id)}
                                                        className="font-bold text-xs text-[oklch(52%_0.16_28)] hover:underline"
                                                    >
                                                        {tx.items?.length || 0} รายการ {isExpanded ? '▲' : '▼'}
                                                    </button>
                                                    <div className="text-[10px] text-[oklch(42%_0.010_28)] truncate max-w-[160px] font-sans">
                                                        {(tx.items || []).map(i => i.name).slice(0, 2).join(', ')}
                                                        {(tx.items?.length || 0) > 2 ? '…' : ''}
                                                    </div>
                                                </td>

                                                {/* Payment Method */}
                                                <td className="p-3 border-r border-[oklch(85%_0.012_28)]">
                                                    <span className="inline-block text-[11px] font-bold px-2 py-0.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                                                        {tx.paymentMethodLabel || 'Cash'}
                                                    </span>
                                                </td>

                                                {/* Total Amount */}
                                                <td className="p-3 text-right border-r border-[oklch(85%_0.012_28)]">
                                                    <div className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                                                        ฿{parseFloat(tx.total_amount || 0).toLocaleString()}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-[oklch(45%_0.08_140)]">
                                                        {tx.status === 'completed' ? 'SETTLED' : tx.status.toUpperCase()}
                                                    </div>
                                                </td>

                                                {/* Action */}
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => toggleRow(tx.id)}
                                                        className="px-2 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] hover:bg-[oklch(18%_0.012_28)] hover:text-[oklch(97%_0.008_28)] font-bold transition-all text-[11px]"
                                                    >
                                                        {isExpanded ? 'ย่อ' : 'ดูบิล'}
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* Expanded Drawer: Itemized Bill Detail */}
                                            {isExpanded && (
                                                <tr className="bg-[oklch(94%_0.010_28)]">
                                                    <td colSpan="8" className="p-4 border-t border-b border-[oklch(85%_0.012_28)]">
                                                        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-3.5 space-y-2.5">
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[oklch(85%_0.012_28)] pb-2 font-mono text-xs">
                                                                <span className="font-bold text-[oklch(18%_0.012_28)]">
                                                                    ITEMIZED BILL DETAILS // TX #{tx.id.slice(0, 8)}
                                                                </span>
                                                                {tx.staff_remark && (
                                                                    <span className="text-[11px] bg-[oklch(94%_0.010_28)] px-2 py-0.5 border border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] font-bold">
                                                                        Remark: {tx.staff_remark}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Items List Grid */}
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 font-mono text-xs">
                                                                {(tx.items || []).map((item, idx) => (
                                                                    <div key={idx} className="p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] flex items-center justify-between">
                                                                        <div>
                                                                            <div className="font-bold text-[oklch(18%_0.012_28)] font-sans">{item.name}</div>
                                                                            <div className="text-[10px] text-[oklch(42%_0.010_28)]">
                                                                                {item.quantity} x ฿{item.price_at_time || item.price}
                                                                            </div>
                                                                        </div>
                                                                        <div className="font-bold text-[oklch(52%_0.16_28)] tabular-nums">
                                                                            ฿{(item.quantity * (item.price_at_time || item.price || 0)).toLocaleString()}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
