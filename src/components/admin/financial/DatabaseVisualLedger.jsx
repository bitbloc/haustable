/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react'
import { 
    Database, 
    Search, 
    Filter, 
    ChevronDown, 
    ChevronUp, 
    ExternalLink, 
    CheckCircle2, 
    Clock, 
    Users, 
    CreditCard, 
    QrCode, 
    Banknote, 
    Layers, 
    Utensils, 
    ShoppingBag, 
    FileSpreadsheet, 
    Copy, 
    Check,
    ArrowUpRight,
    ShieldCheck
} from 'lucide-react'
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
        <div className="space-y-4 md:space-y-6">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-[oklch(85%_0.012_28)] gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <Database size={20} className="text-[oklch(52%_0.16_28)] shrink-0" />
                        <h3 className="font-black text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                            Live Database Visual Ledger & Audit Stream
                        </h3>
                    </div>
                    <p className="text-xs font-semibold text-[oklch(42%_0.010_28)] mt-0.5">
                        สมุดบันทึกธุรกรรมฐานข้อมูลจริง ตรวจสอบย้อนรอยบิลทุกยอดเงินSatang ({timeRangeLabel})
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <button
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl font-mono text-xs text-[oklch(18%_0.012_28)] font-black hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <FileSpreadsheet size={14} className="text-emerald-700" />
                        <span>EXPORT CSV ({filteredTransactions.length})</span>
                    </button>
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-300 rounded-lg font-mono text-[11px] text-emerald-900 font-bold">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>LIVE POS SYNC</span>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar Ribbon */}
            <div className="bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-3.5 md:p-4 space-y-3 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[oklch(42%_0.010_28)]" />
                        <input
                            type="text"
                            placeholder="ค้นหาด้วย Transaction ID, โต๊ะ, ชื่อลูกค้า, หรือชื่อเมนู..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl font-mono text-xs text-[oklch(18%_0.012_28)] font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)] transition-all"
                        />
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                        {/* Payment Filter */}
                        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border-2 border-[oklch(85%_0.012_28)] shrink-0">
                            {[
                                { id: 'all', label: 'ชำระทั้งหมด' },
                                { id: 'qr', label: 'PromptPay QR' },
                                { id: 'cash', label: 'เงินสด' },
                                { id: 'credit', label: 'บัตร' },
                                { id: 'split', label: 'Split' },
                            ].map(btn => (
                                <button
                                    key={btn.id}
                                    onClick={() => setPaymentFilter(btn.id)}
                                    className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all font-black whitespace-nowrap ${
                                        paymentFilter === btn.id
                                            ? 'bg-[oklch(18%_0.012_28)] text-white'
                                            : 'text-[oklch(42%_0.010_28)] hover:bg-gray-100'
                                    }`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>

                        {/* Channel Filter */}
                        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border-2 border-[oklch(85%_0.012_28)] shrink-0">
                            {[
                                { id: 'all', label: 'ทุกช่องทาง' },
                                { id: 'dine_in', label: 'ทานที่ร้าน' },
                                { id: 'pickup', label: 'Takeaway' },
                            ].map(btn => (
                                <button
                                    key={btn.id}
                                    onClick={() => setChannelFilter(btn.id)}
                                    className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all font-black whitespace-nowrap ${
                                        channelFilter === btn.id
                                            ? 'bg-[oklch(52%_0.16_28)] text-white'
                                            : 'text-[oklch(42%_0.010_28)] hover:bg-gray-100'
                                    }`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Ledger Quick Summary Bar */}
                <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-[oklch(85%_0.012_28)] flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                        <span className="text-[oklch(42%_0.010_28)] font-bold">
                            พบ <strong className="text-[oklch(18%_0.012_28)] font-black">{filteredTransactions.length}</strong> รายการ
                        </span>
                        <span className="text-[oklch(42%_0.010_28)] font-bold">
                            ยอดรวมคัดกรอง: <strong className="text-[oklch(52%_0.16_28)] font-black">฿{totalFilteredAmount.toLocaleString()}</strong>
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={expandAll}
                            className="text-[11px] font-bold text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] underline"
                        >
                            ขยายดูเมนูทั้งหมด
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                            onClick={collapseAll}
                            className="text-[11px] font-bold text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] underline"
                        >
                            ย่อทั้งหมด
                        </button>
                    </div>
                </div>
            </div>

            {/* Visual Table Container */}
            <div className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs min-w-[760px]">
                        <thead>
                            <tr className="bg-[oklch(97%_0.008_28)] border-b-2 border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] uppercase tracking-wider text-[11px] font-black">
                                <th className="p-3.5">TIME / TX ID</th>
                                <th className="p-3.5">TABLE / CHANNEL</th>
                                <th className="p-3.5">GUEST / MEMBER</th>
                                <th className="p-3.5">PAX</th>
                                <th className="p-3.5">ITEMS AUDIT</th>
                                <th className="p-3.5">PAYMENT METHOD</th>
                                <th className="p-3.5 text-right">TOTAL AMOUNT</th>
                                <th className="p-3.5 text-center">ACTION</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-[oklch(94%_0.010_28)]">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="p-8 text-center text-gray-400 font-sans">
                                        <div className="space-y-1">
                                            <p className="font-bold text-sm text-[oklch(18%_0.012_28)]">ไม่พบรายการธุรกรรมตามเงื่อนไขที่ค้นหา</p>
                                            <p className="text-xs text-[oklch(42%_0.010_28)]">ลองปรับคำค้นหาหรือเปลี่ยนตัวกรองชำระเงิน</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((tx) => {
                                    const isExpanded = expandedRowIds.has(tx.id)
                                    const isDineIn = tx.booking_type !== 'pickup'
                                    const isPaidByQr = (tx.paymentMethod || '').toLowerCase().includes('qr') || tx.payment_slip_url
                                    const isPaidByCash = (tx.paymentMethod || '').toLowerCase().includes('cash')
                                    const isPaidByCredit = (tx.paymentMethod || '').toLowerCase().includes('credit')
                                    const isSplit = tx.isSplit

                                    return (
                                        <React.Fragment key={tx.id}>
                                            <tr className="hover:bg-[oklch(97%_0.008_28)] transition-colors group">
                                                {/* Time / TX ID */}
                                                <td className="p-3.5">
                                                    <div className="font-black text-sm text-[oklch(18%_0.012_28)]">
                                                        {formatThaiTimeOnly(tx.booking_time)}
                                                    </div>
                                                    <button
                                                        onClick={() => handleCopyId(tx.id)}
                                                        className="flex items-center gap-1 text-[10px] text-[oklch(42%_0.010_28)] font-mono hover:text-[oklch(52%_0.16_28)] mt-0.5 group-hover:underline"
                                                        title="Click to copy full UUID"
                                                    >
                                                        <span>#{tx.id.slice(0, 8)}</span>
                                                        {copiedId === tx.id ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                                                    </button>
                                                </td>

                                                {/* Table / Channel */}
                                                <td className="p-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-black text-xs text-[oklch(18%_0.012_28)] px-2 py-0.5 rounded bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                                                            {tx.tableName || (isDineIn ? 'WALK-IN' : 'PICKUP')}
                                                        </span>
                                                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                                            isDineIn ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                                                        }`}>
                                                            {isDineIn ? 'Dine-In' : 'Takeaway'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Guest / Member */}
                                                <td className="p-3.5">
                                                    <div className="font-black text-xs text-[oklch(18%_0.012_28)]">
                                                        {tx.guestName || 'Guest'}
                                                    </div>
                                                    {tx.memberTier && (
                                                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 inline-block mt-0.5">
                                                            ★ {tx.memberTier}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Pax */}
                                                <td className="p-3.5">
                                                    <span className="font-black text-xs text-[oklch(18%_0.012_28)]">
                                                        {tx.pax || 1}
                                                    </span>
                                                    <span className="text-[10px] text-[oklch(42%_0.010_28)] ml-0.5">ท่าน</span>
                                                </td>

                                                {/* Items Audit */}
                                                <td className="p-3.5">
                                                    <button
                                                        onClick={() => toggleRow(tx.id)}
                                                        className="flex items-center gap-1 text-xs font-bold text-[oklch(52%_0.16_28)] hover:underline"
                                                    >
                                                        <span>{tx.items?.length || 0} รายการ</span>
                                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    </button>
                                                    <div className="text-[10px] text-[oklch(42%_0.010_28)] truncate max-w-[160px]">
                                                        {(tx.items || []).map(i => i.name).slice(0, 2).join(', ')}
                                                        {(tx.items?.length || 0) > 2 ? '...' : ''}
                                                    </div>
                                                </td>

                                                {/* Payment Method */}
                                                <td className="p-3.5">
                                                    <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-lg border ${
                                                        isSplit ? 'bg-purple-100 text-purple-900 border-purple-300' :
                                                        isPaidByQr ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                                                        isPaidByCredit ? 'bg-indigo-100 text-indigo-900 border-indigo-300' :
                                                        'bg-amber-100 text-amber-900 border-amber-300'
                                                    }`}>
                                                        {isSplit ? <Layers size={12} /> :
                                                         isPaidByQr ? <QrCode size={12} /> :
                                                         isPaidByCredit ? <CreditCard size={12} /> :
                                                         <Banknote size={12} />}
                                                        <span>{tx.paymentMethodLabel || 'Cash'}</span>
                                                    </span>
                                                </td>

                                                {/* Total Amount */}
                                                <td className="p-3.5 text-right">
                                                    <div className="font-black text-sm md:text-base text-[oklch(18%_0.012_28)]">
                                                        ฿{parseFloat(tx.total_amount || 0).toLocaleString()}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-emerald-700">
                                                        {tx.status === 'completed' ? 'SETTLED' : tx.status.toUpperCase()}
                                                    </div>
                                                </td>

                                                {/* Action */}
                                                <td className="p-3.5 text-center">
                                                    <button
                                                        onClick={() => toggleRow(tx.id)}
                                                        className="p-1.5 rounded-lg hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] transition-all"
                                                        title="ดูรายการอาหารและหมายเหตุ"
                                                    >
                                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* Expanded Drawer: Itemized Bill Detail */}
                                            {isExpanded && (
                                                <tr className="bg-[oklch(97%_0.008_28)]">
                                                    <td colSpan="8" className="p-4 border-t border-b border-[oklch(85%_0.012_28)]">
                                                        <div className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl p-4 space-y-3 shadow-inner">
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[oklch(85%_0.012_28)] pb-2 font-sans">
                                                                <div className="flex items-center gap-2">
                                                                    <Utensils size={16} className="text-[oklch(52%_0.16_28)]" />
                                                                    <span className="font-black text-xs text-[oklch(18%_0.012_28)]">
                                                                        รายละเอียดบิลและรายการอาหาร (Transaction #{tx.id.slice(0, 8)})
                                                                    </span>
                                                                </div>
                                                                {tx.staff_remark && (
                                                                    <span className="text-[11px] font-mono bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-300 font-bold">
                                                                        Remark: {tx.staff_remark}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Items List Grid */}
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 font-mono text-xs">
                                                                {(tx.items || []).map((item, idx) => (
                                                                    <div key={idx} className="p-2.5 rounded-lg bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] flex items-center justify-between">
                                                                        <div>
                                                                            <div className="font-black text-[oklch(18%_0.012_28)]">{item.name}</div>
                                                                            <div className="text-[10px] text-[oklch(42%_0.010_28)]">
                                                                                {item.quantity} x ฿{item.price_at_time || item.price}
                                                                            </div>
                                                                        </div>
                                                                        <div className="font-black text-[oklch(52%_0.16_28)]">
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
