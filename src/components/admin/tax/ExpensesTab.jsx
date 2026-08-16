/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Plus, 
    Download, 
    Search, 
    Calendar, 
    DollarSign, 
    TrendingUp, 
    TrendingDown, 
    PieChart, 
    FileText, 
    Image as ImageIcon, 
    Trash2, 
    Edit2, 
    CheckCircle2, 
    AlertCircle, 
    X,
    ExternalLink
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { downloadCsvFile } from '../../../utils/thaiTaxHelper';
import { EXPENSE_CATEGORIES } from '../../../utils/expenseConstants';
import { toast } from 'sonner';

export default function ExpensesTab({ 
    onOpenCreateModal, 
    onOpenEditModal,
    monthlyPosRevenue = 0 
}) {
    const [expenses, setExpenses] = useState(() => {
        try {
            const local = localStorage.getItem('onhaus_store_expenses');
            return local ? JSON.parse(local) : [];
        } catch {
            return [];
        }
    });

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    });

    const [categoryFilter, setCategoryFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [previewImage, setPreviewImage] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const loadExpenses = async () => {
            try {
                const { data, error } = await supabase
                    .from('store_expenses')
                    .select('*')
                    .order('expense_date', { ascending: false });

                if (isMounted && !error && data && data.length > 0) {
                    setExpenses(data);
                    localStorage.setItem('onhaus_store_expenses', JSON.stringify(data));
                }
            } catch {
                // Fallback to local
            }
        };

        loadExpenses();

        return () => {
            isMounted = false;
        };
    }, []);

    // Filtered Expenses
    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            const expMonth = (exp.expense_date || '').slice(0, 7);
            const matchesMonth = !selectedMonth || expMonth === selectedMonth;

            const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;

            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q || 
                (exp.title || '').toLowerCase().includes(q) ||
                (exp.vendor_name || '').toLowerCase().includes(q) ||
                (exp.notes || '').toLowerCase().includes(q);

            return matchesMonth && matchesCategory && matchesSearch;
        });
    }, [expenses, selectedMonth, categoryFilter, searchQuery]);

    // Monthly Aggregates
    const monthlyStats = useMemo(() => {
        const totalExpense = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        
        // Category breakdown
        const byCategory = {};
        EXPENSE_CATEGORIES.forEach(c => { byCategory[c.id] = 0; });
        filteredExpenses.forEach(e => {
            const cat = e.category || 'other';
            byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount || 0);
        });

        // Grade A, B, C breakdown
        const gradeA = filteredExpenses.filter(e => e.doc_type === 'tax_invoice').reduce((s, e) => s + Number(e.amount || 0), 0);
        const gradeB = filteredExpenses.filter(e => e.doc_type === 'cash_bill').reduce((s, e) => s + Number(e.amount || 0), 0);
        const gradeC = filteredExpenses.filter(e => e.doc_type === 'receipt_voucher' || e.doc_type === 'slip_only').reduce((s, e) => s + Number(e.amount || 0), 0);

        const rawMaterialCost = byCategory['raw_material'] || 0;
        const netProfit = (monthlyPosRevenue || 0) - totalExpense;
        const foodCostPct = monthlyPosRevenue > 0 ? ((rawMaterialCost / monthlyPosRevenue) * 100) : 0;

        return {
            totalExpense,
            byCategory,
            gradeA,
            gradeB,
            gradeC,
            rawMaterialCost,
            netProfit,
            foodCostPct,
            count: filteredExpenses.length
        };
    }, [filteredExpenses, monthlyPosRevenue]);

    // Delete Record
    const handleDelete = async (id, title) => {
        if (!confirm(`ต้องการลบรายการค่าใช้จ่าย "${title}" หรือไม่?`)) return;
        try {
            if (!String(id).startsWith('local_')) {
                await supabase.from('store_expenses').delete().eq('id', id);
            }
        } catch {
            // Local deletion
        }

        const updated = expenses.filter(e => e.id !== id);
        setExpenses(updated);
        localStorage.setItem('onhaus_store_expenses', JSON.stringify(updated));
        toast.success(`ลบรายการ ${title} แล้ว`);
    };

    // Export CSV
    const handleExportCsv = () => {
        if (filteredExpenses.length === 0) {
            toast.warning('ไม่พบข้อมูลค่าใช้จ่ายในเดือนนี้');
            return;
        }

        const headers = [
            'ลำดับ (No.)',
            'วันที่จ่าย (Date)',
            'รายการค่าใช้จ่าย (Title)',
            'หมวดหมู่ (Category)',
            'ร้านค้า / ผู้รับเงิน (Vendor)',
            'ชนิดเอกสาร (Doc Type)',
            'จำนวนเงิน (Amount THB)',
            'วิธีชำระเงิน (Pay Method)',
            'หมายเหตุ (Notes)',
            'มีรูปใบเสร็จ (Has Photo)'
        ];

        const rows = filteredExpenses.map((exp, idx) => {
            const catLabel = EXPENSE_CATEGORIES.find(c => c.id === exp.category)?.label || exp.category;
            return [
                idx + 1,
                `"${exp.expense_date || '-'}"`,
                `"${(exp.title || '-').replace(/"/g, '""')}"`,
                `"${catLabel}"`,
                `"${(exp.vendor_name || '-').replace(/"/g, '""')}"`,
                `"${exp.doc_type || 'tax_invoice'}"`,
                Number(exp.amount || 0).toFixed(2),
                `"${exp.payment_method || 'TRANSFER'}"`,
                `"${(exp.notes || '').replace(/"/g, '""')}"`,
                exp.receipt_image_url ? '"YES"' : '"NO"'
            ];
        });

        const summaryRow = [
            'รวมค่าใช้จ่ายทั้งสิ้น (TOTAL EXPENSES)',
            '',
            '',
            '',
            '',
            '',
            monthlyStats.totalExpense.toFixed(2),
            '',
            '',
            `"รวม ${monthlyStats.count} รายการ"`
        ];

        const csvLines = [
            `"รายงานสรุปค่าใช้จ่ายและต้นทุนร้าน (Store Expenses & COGS Ledger) - ประจำงวด ${selectedMonth}"`,
            headers.join(','),
            ...rows.map(r => r.join(',')),
            summaryRow.join(',')
        ];

        downloadCsvFile(csvLines.join('\r\n'), `Store_Expenses_${selectedMonth}.csv`);
        toast.success('ดาวน์โหลดรายงานค่าใช้จ่ายเรียบร้อยแล้ว');
    };

    return (
        <div className="space-y-6">
            {/* Top Overview: Real Net Profit & Financial Performance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Gross Revenue from POS */}
                <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 shadow-sm">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                        รายรับรวมจาก POS (Gross Revenue)
                    </span>
                    <div className="font-mono font-black text-xl text-zinc-950 mt-1">
                        ฿{Number(monthlyPosRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        ยอดขายประจำงวด {selectedMonth}
                    </span>
                </div>

                {/* Total Store Expenses */}
                <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 shadow-sm">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                        ค่าใช้จ่ายร้านรวม (Total Expenses)
                    </span>
                    <div className="font-mono font-black text-xl text-red-600 mt-1">
                        ฿{monthlyStats.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        Makro + ค่าน้ำไฟ + ค่าเช่า ({monthlyStats.count} รายการ)
                    </span>
                </div>

                {/* Real Net Profit */}
                <div className={`rounded-2xl p-4 shadow-sm border ${monthlyStats.netProfit >= 0 ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950' : 'bg-red-50/70 border-red-300 text-red-950'}`}>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider block opacity-75">
                        กำไรสุทธิจริง (Real Net Profit)
                    </span>
                    <div className="font-mono font-black text-2xl mt-1">
                        ฿{monthlyStats.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] font-mono mt-0.5 block opacity-75">
                        {monthlyStats.netProfit >= 0 ? '✓ ผลประกอบการกำไรเป็นบวก' : '⚠️ รายจ่ายสูงกว่ารายรับ'}
                    </span>
                </div>

                {/* Food Cost COGS % */}
                <div className="bg-[#1A1A1A] text-white rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                            Food & Drink Cost % (ต้นทุน Makro)
                        </span>
                        <div className="font-mono font-black text-xl text-amber-400 mt-1">
                            {monthlyStats.foodCostPct.toFixed(1)}%
                        </div>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                        เป้าหมายธุรกิจคาเฟ่/ร้านอาหาร: 30 - 35%
                    </span>
                </div>
            </div>

            {/* Tax Deductible Proof Grades & Category Breakdown Ribbon */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Proof Grades Card */}
                <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 sm:p-5 shadow-sm space-y-2.5">
                    <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
                        <FileText size={16} className="text-zinc-700" />
                        <span className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-900">
                            ความน่าเชื่อถือเอกสารยื่นภาษี (Tax Proofs)
                        </span>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
                            <span>🥇 เกรด A (ใบกำกับ Makro/น้ำไฟ):</span>
                            <strong>฿{monthlyStats.gradeA.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-800">
                            <span>🥈 เกรด B (บิลเงินสด + สลิป):</span>
                            <strong>฿{monthlyStats.gradeB.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-800">
                            <span>🥉 เกรด C (ใบสำคัญรับเงิน/สลิป):</span>
                            <strong>฿{monthlyStats.gradeC.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                        </div>
                    </div>
                </div>

                {/* Major Categories Breakdown */}
                <div className="md:col-span-2 bg-white border border-[#D1D1CD] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                    <span className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-900 block border-b border-zinc-200 pb-2">
                        สัดส่วนค่าใช้จ่ายหลักประจำงวด {selectedMonth}
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 font-mono text-xs">
                        {EXPENSE_CATEGORIES.map(cat => {
                            const val = monthlyStats.byCategory[cat.id] || 0;
                            return (
                                <div key={cat.id} className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between">
                                    <span className="text-[10px] text-zinc-500 block truncate" title={cat.label}>
                                        {cat.label}
                                    </span>
                                    <strong className={`text-xs sm:text-sm block mt-1 ${val > 0 ? 'text-zinc-950 font-black' : 'text-zinc-400 font-medium'}`}>
                                        ฿{val.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </strong>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Control & Filter Toolbar */}
            <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono font-bold focus:border-zinc-900 focus:outline-none bg-white"
                    />

                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono focus:border-zinc-900 focus:outline-none bg-white"
                    >
                        <option value="all">ทุกหมวดหมู่ค่าใช้จ่าย</option>
                        {EXPENSE_CATEGORIES.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                    </select>

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อรายการ / ร้านค้า..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 pr-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono w-44 sm:w-60 focus:border-zinc-900 focus:outline-none bg-white"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportCsv}
                        className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg font-mono font-bold text-xs flex items-center gap-1.5 border border-zinc-300 transition-colors cursor-pointer"
                    >
                        <Download size={14} />
                        <span>Export CSV / บัญชี</span>
                    </button>

                    <button
                        onClick={onOpenCreateModal}
                        className="px-4 py-1.5 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white rounded-lg font-mono font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                    >
                        <Plus size={15} />
                        <span>บันทึกค่าใช้จ่าย & ถ่ายรูปบิล</span>
                    </button>
                </div>
            </div>

            {/* Expenses Ledger Table */}
            <div className="bg-white border border-[#D1D1CD] rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-sm text-zinc-950 font-mono">
                        สมุดบันทึกค่าใช้จ่ายและต้นทุนร้าน (Expenses & Purchases Ledger)
                    </h3>
                    <span className="text-xs font-mono text-zinc-500">
                        จำนวน {filteredExpenses.length} รายการ
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-zinc-100 border-b border-zinc-300 font-mono text-[10px] uppercase text-zinc-700">
                                <th className="p-3 w-10 text-center">No.</th>
                                <th className="p-3 w-24">วันที่จ่าย</th>
                                <th className="p-3">รายการค่าใช้จ่าย</th>
                                <th className="p-3 w-40">หมวดหมู่</th>
                                <th className="p-3 w-36">ร้านค้า / ผู้รับ</th>
                                <th className="p-3 w-28 text-center">หลักฐาน</th>
                                <th className="p-3 text-right w-32">จำนวนเงิน</th>
                                <th className="p-3 text-center w-20">รูปบิล</th>
                                <th className="p-3 text-center w-20">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                            {filteredExpenses.map((exp, idx) => {
                                const catObj = EXPENSE_CATEGORIES.find(c => c.id === exp.category);
                                const isGradeA = exp.doc_type === 'tax_invoice';

                                return (
                                    <tr key={exp.id || idx} className="hover:bg-zinc-50 transition-colors">
                                        <td className="p-3 text-center font-mono text-zinc-400">{idx + 1}</td>
                                        <td className="p-3 font-mono">{exp.expense_date}</td>
                                        <td className="p-3">
                                            <div className="font-semibold text-zinc-900">{exp.title}</div>
                                            {exp.notes && <div className="text-[10px] text-zinc-400 font-mono">{exp.notes}</div>}
                                        </td>
                                        <td className="p-3 font-mono text-[11px] text-zinc-700">
                                            {catObj?.label || exp.category}
                                        </td>
                                        <td className="p-3 font-medium text-zinc-800">
                                            {exp.vendor_name || '-'}
                                        </td>
                                        <td className="p-3 text-center font-mono">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                                isGradeA ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-700'
                                            }`}>
                                                {isGradeA ? 'ใบกำกับภาษี (A)' : 'บิลเงินสด (B)'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-sm text-zinc-950">
                                            ฿{Number(exp.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3 text-center">
                                            {exp.receipt_image_url ? (
                                                <button
                                                    onClick={() => setPreviewImage(exp.receipt_image_url)}
                                                    className="p-1.5 text-zinc-700 hover:text-[oklch(52%_0.16_28)] transition-colors cursor-pointer bg-zinc-100 hover:bg-zinc-200 rounded-lg inline-flex items-center gap-1"
                                                    title="ดูรูปใบเสร็จ / บิล Makro"
                                                >
                                                    <ImageIcon size={14} />
                                                    <span className="font-mono text-[9px] font-bold">ดูรูป</span>
                                                </button>
                                            ) : (
                                                <span className="text-[10px] font-mono text-zinc-400">-</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => onOpenEditModal && onOpenEditModal(exp)}
                                                    className="p-1 text-zinc-500 hover:text-zinc-950 transition-colors cursor-pointer"
                                                    title="แก้ไข"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(exp.id, exp.title)}
                                                    className="p-1 text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
                                                    title="ลบ"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredExpenses.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center text-zinc-400 font-mono">
                                        ยังไม่มีการบันทึกค่าใช้จ่ายในเดือนนี้ (กด "บันทึกค่าใช้จ่าย & ถ่ายรูปบิล" เพื่อเริ่มต้น)
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Receipt Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto font-sans">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-300">
                        <div className="p-4 bg-[#1A1A1A] text-white flex justify-between items-center shrink-0">
                            <span className="font-mono font-bold text-xs">รูปถ่ายใบเสร็จ / บิล Makro / สลิปโอนเงิน</span>
                            <button onClick={() => setPreviewImage(null)} className="p-1 text-white hover:bg-white/10 rounded cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-zinc-900">
                            <img src={previewImage} alt="Receipt Full View" className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
