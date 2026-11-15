/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react';
import { 
    FileText, 
    Plus, 
    Download, 
    Printer, 
    Search, 
    Trash2, 
    Building2, 
    UserCheck, 
    X,
    Save
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { 
    thaiBahtText, 
    formatTaxId, 
    exportWithholdingTaxCsv, 
    downloadCsvFile,
    toBangkokDateKey
} from '../../../utils/thaiTaxHelper';
import { generateTaxDocumentPdf, downloadTaxPdf } from '../../../utils/taxPdfHelper';
import { toast } from 'sonner';

export default function WithholdingTaxTab({ 
    companySettings = {} 
}) {
    const [records, setRecords] = useState(() => {
        try {
            const local = localStorage.getItem('onhaus_wht_records');
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

    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [activePrintRecord, setActivePrintRecord] = useState(null);

    // Form Modal State
    const [payeeType, setPayeeType] = useState('company'); // 'company' | 'individual'
    const [payeeName, setPayeeName] = useState('');
    const [payeeTaxId, setPayeeTaxId] = useState('');
    const [payeeAddress, setPayeeAddress] = useState('');
    const [incomeType, setIncomeType] = useState('ค่าบริการ 3%');
    const [taxRate, setTaxRate] = useState(3);
    const [grossAmount, setGrossAmount] = useState('');
    const [formType, setFormType] = useState('PND53'); // 'PND1' | 'PND3' | 'PND53'
    const [paymentDate, setPaymentDate] = useState(() => toBangkokDateKey(new Date()));
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [whtPdfBusy, setWhtPdfBusy] = useState(false);

    // Sync from database with Realtime
    React.useEffect(() => {
        fetchWhtRecords();

        let debounceTimer = null;
        const debouncedReload = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchWhtRecords();
            }, 400);
        };

        const channel = supabase
            .channel('admin-wht-records-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'withholding_tax_records' }, debouncedReload)
            .subscribe();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchWhtRecords = async () => {
        try {
            const { data, error } = await supabase
                .from('withholding_tax_records')
                .select('*')
                .order('payment_date', { ascending: false });

            if (!error && data) {
                setRecords(data);
                localStorage.setItem('onhaus_wht_records', JSON.stringify(data));
            }
        } catch (e) {
            console.warn('WHT fetch fallback to local:', e);
        }
    };

    // Filter records
    const filteredRecords = useMemo(() => {
        return records.filter(rec => {
            const recMonth = (rec.payment_date || '').slice(0, 7);
            const matchesMonth = !selectedMonth || recMonth === selectedMonth;

            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q || 
                (rec.doc_number || '').toLowerCase().includes(q) ||
                (rec.payee_name || '').toLowerCase().includes(q) ||
                (rec.payee_tax_id || '').includes(q);

            return matchesMonth && matchesSearch;
        });
    }, [records, selectedMonth, searchQuery]);

    // Monthly totals
    // Cancelled certificates stay listed but are not part of the amounts to file
    const activeRecords = useMemo(() => filteredRecords.filter(r => r.status !== 'cancelled'), [filteredRecords]);
    const totals = useMemo(() => {
        const gross = activeRecords.reduce((s, r) => s + Number(r.gross_amount || 0), 0);
        const tax = activeRecords.reduce((s, r) => s + Number(r.tax_withheld || 0), 0);
        const net = activeRecords.reduce((s, r) => s + Number(r.net_paid || 0), 0);
        return { gross, tax, net, count: activeRecords.length };
    }, [activeRecords]);

    // Handle Income Type change (Auto set default rate & form type)
    const handleIncomeTypeChange = (e) => {
        const val = e.target.value;
        setIncomeType(val);
        if (val.includes('1%')) {
            setTaxRate(1);
        } else if (val.includes('2%')) {
            setTaxRate(2);
        } else if (val.includes('3%')) {
            setTaxRate(3);
        } else if (val.includes('5%')) {
            setTaxRate(5);
        }
    };

    const handlePayeeTypeChange = (type) => {
        setPayeeType(type);
        if (type === 'company') {
            setFormType('PND53');
        } else {
            setFormType('PND3');
        }
    };

    // Save WHT Record
    const handleSaveWht = async () => {
        if (!payeeName.trim()) {
            toast.error('กรุณากรอกชื่อผู้รับเงิน / ผู้ถูกหักภาษี');
            return;
        }
        if (!grossAmount || Number(grossAmount) <= 0) {
            toast.error('กรุณาระบุจำนวนเงินที่จ่าย');
            return;
        }

        setSaving(true);
        try {
            const gross = Number(grossAmount);
            const rate = Number(taxRate);
            const taxWithheld = parseFloat(((gross * rate) / 100).toFixed(2));
            const netPaid = parseFloat((gross - taxWithheld).toFixed(2));

            const prefix = companySettings?.tax_wht_prefix || 'WHT';
            const ym = paymentDate.slice(0, 7).replace('-', '');
            const randSeq = Math.floor(Math.random() * 9000) + 1000;
            const docNumber = `${prefix}-${ym}-${randSeq}`;

            const recordPayload = {
                doc_number: docNumber,
                payee_type: payeeType,
                payee_name: payeeName.trim(),
                payee_tax_id: payeeTaxId.replace(/\D/g, ''),
                payee_address: payeeAddress.trim() || '-',
                income_type: incomeType,
                tax_rate: rate,
                gross_amount: gross,
                tax_withheld: taxWithheld,
                net_paid: netPaid,
                form_type: formType,
                payment_date: paymentDate,
                notes: notes.trim()
            };

            // DB Insert: a certificate that is not in the database was not issued, so failures surface
            let saved = null;
            for (let attempt = 0; attempt < 5 && !saved; attempt++) {
                const payload = attempt === 0 ? recordPayload
                    : { ...recordPayload, doc_number: `${prefix}-${ym}-${Math.floor(Math.random() * 9000) + 1000}` };
                const { data, error } = await supabase
                    .from('withholding_tax_records')
                    .insert([payload])
                    .select()
                    .single();
                if (!error && data) { saved = data; break; }
                if (error?.code === '23505') continue; // number taken, draw another
                throw new Error(error?.message || 'บันทึกลงฐานข้อมูลไม่สำเร็จ');
            }
            if (!saved) throw new Error('สร้างเลขที่เอกสารไม่ซ้ำไม่สำเร็จ ลองใหม่อีกครั้ง');

            // LocalStorage sync
            const updated = [saved, ...records];
            setRecords(updated);
            localStorage.setItem('onhaus_wht_records', JSON.stringify(updated));

            toast.success(`บันทึกภาษีหัก ณ ที่จ่าย ${saved.doc_number || docNumber} เรียบร้อยแล้ว`);
            setShowCreateModal(false);
            resetForm();
        } catch (err) {
            toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setPayeeName('');
        setPayeeTaxId('');
        setPayeeAddress('');
        setGrossAmount('');
        setNotes('');
    };

    // 50 ทวิ certificates are kept for 5 years: a wrong one is cancelled, never deleted
    const handleCancelRecord = async (id, docNo) => {
        const reason = window.prompt(`ยกเลิกเอกสาร ${docNo}\nระบุเหตุผล (เอกสารยังเก็บไว้ในระบบ ไม่ถูกลบ):`);
        if (reason === null) return;
        if (!reason.trim()) {
            toast.error('กรุณาระบุเหตุผลการยกเลิก');
            return;
        }
        const patch = { status: 'cancelled', cancellation_reason: reason.trim(), cancelled_at: new Date().toISOString() };
        const { error } = await supabase.from('withholding_tax_records').update(patch).eq('id', id);
        if (error) {
            toast.error('ยกเลิกไม่สำเร็จ: ' + error.message);
            return;
        }
        const updated = records.map(r => (r.id === id ? { ...r, ...patch } : r));
        setRecords(updated);
        localStorage.setItem('onhaus_wht_records', JSON.stringify(updated));
        toast.success(`ยกเลิกเอกสาร ${docNo} แล้ว`);
    };

    const handleExportCsv = () => {
        if (activeRecords.length === 0) {
            toast.warning('ไม่มีรายการภาษีหัก ณ ที่จ่ายในเดือนที่เลือก');
            return;
        }
        const csv = exportWithholdingTaxCsv(activeRecords, selectedMonth);
        downloadCsvFile(csv, `Withholding_Tax_Report_${selectedMonth}.csv`);
        toast.success('ดาวน์โหลดรายงานภาษีหัก ณ ที่จ่ายเรียบร้อย');
    };

    return (
        <div className="space-y-6">
            {/* Header Toolbar */}
            <div className="bg-[oklch(99%_0.004_28)] border border-[#D1D1CD] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 ">
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-1.5 border border-[oklch(85%_0.012_28)] rounded-lg text-xs tabular-nums font-bold focus:border-zinc-900 focus:outline-none bg-[oklch(99%_0.004_28)]"
                    />

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(50%_0.010_28)]" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อผู้รับ เลขผู้เสียภาษี หรือเลขที่"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 pr-3 py-1.5 border border-[oklch(85%_0.012_28)] rounded-lg text-xs tabular-nums w-48 sm:w-64 focus:border-zinc-900 focus:outline-none bg-[oklch(99%_0.004_28)]"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportCsv}
                        className="px-3.5 py-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.008_28)] text-[oklch(18%_0.012_28)] rounded-lg tabular-nums font-bold text-xs flex items-center gap-1.5 border border-[oklch(85%_0.012_28)] transition-colors cursor-pointer"
                    >
                        <Download size={14} />
                        <span>ส่งออก CSV</span>
                    </button>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-1.5 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-[oklch(97%_0.008_28)] rounded-lg tabular-nums font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                    >
                        <Plus size={15} />
                        <span>บันทึกหัก ณ ที่จ่าย (ใบ 50 ทวิ)</span>
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[oklch(99%_0.004_28)] border border-[#D1D1CD] rounded-xl p-4 ">
                    <span className="tabular-nums text-xs font-bold text-[oklch(50%_0.010_28)] block">
                        ยอดจ่ายค่าจ้าง / บริการทั้งหมด
                    </span>
                    <div className="tabular-nums font-black text-xl text-[oklch(18%_0.012_28)] mt-1">
                        ฿{totals.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-xs text-[oklch(50%_0.010_28)] tabular-nums mt-0.5 block">
                        ประจำเดือน {selectedMonth} ({totals.count} รายการ)
                    </span>
                </div>

                <div className="bg-[oklch(99%_0.004_28)] border border-[#D1D1CD] rounded-xl p-4 ">
                    <span className="tabular-nums text-xs font-bold text-[oklch(50%_0.010_28)] block">
                        ภาษีที่หักและต้องนำส่ง
                    </span>
                    <div className="tabular-nums font-black text-xl text-[oklch(52%_0.16_28)] mt-1">
                        ฿{totals.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-xs text-[oklch(50%_0.010_28)] tabular-nums mt-0.5 block">
                        สำหรับยื่นแบบ ภ.ง.ด. 1/3/53 ภายในวันที่ 7-15
                    </span>
                </div>

                <div className="bg-[#1A1A1A] text-[oklch(97%_0.008_28)] rounded-xl p-4 ">
                    <span className="tabular-nums text-xs font-bold text-[oklch(50%_0.010_28)] block">
                        ยอดจ่ายสุทธิหลังหักภาษี
                    </span>
                    <div className="tabular-nums font-black text-xl text-emerald-400 mt-1">
                        ฿{totals.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-xs text-[oklch(50%_0.010_28)] tabular-nums mt-0.5 block">
                        ยอดโอนเงินจริงให้ผู้รับจ้าง/คู่ค้า
                    </span>
                </div>
            </div>

            {/* Records Ledger Table */}
            <div className="bg-[oklch(99%_0.004_28)] border border-[#D1D1CD] rounded-2xl overflow-hidden ">
                <div className="px-5 py-4 border-b border-[oklch(90%_0.008_28)] bg-zinc-50/50">
                    <h3 className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                        สมุดบันทึกรายการภาษีหัก ณ ที่จ่าย
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] tabular-nums text-xs text-[oklch(42%_0.010_28)]">
                                <th className="p-3 w-10 text-center">No.</th>
                                <th className="p-3 w-24">วันที่จ่าย</th>
                                <th className="p-3 w-32">เลขที่ 50 ทวิ</th>
                                <th className="p-3 w-20">แบบยื่น</th>
                                <th className="p-3">ผู้ถูกหักภาษี</th>
                                <th className="p-3 w-32">เลขประจำตัว 13 หลัก</th>
                                <th className="p-3">ประเภทเงินได้</th>
                                <th className="p-3 text-right w-24">อัตรา</th>
                                <th className="p-3 text-right w-28">ยอดจ่าย</th>
                                <th className="p-3 text-right w-28">ภาษีที่หัก</th>
                                <th className="p-3 text-right w-28">ยอดสุทธิ</th>
                                <th className="p-3 text-center w-20">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[oklch(90%_0.008_28)]">
                            {filteredRecords.map((rec, idx) => (
                                <tr key={rec.id || idx} className={`hover:bg-[oklch(97%_0.008_28)] transition-colors ${rec.status === 'cancelled' ? 'opacity-50' : ''}`}>
                                    <td className="p-3 text-center tabular-nums text-[oklch(50%_0.010_28)]">{idx + 1}</td>
                                    <td className="p-3 tabular-nums">{rec.payment_date}</td>
                                    <td className="p-3 tabular-nums font-bold text-[oklch(18%_0.012_28)]">
                                        <span className={rec.status === 'cancelled' ? 'line-through' : ''}>{rec.doc_number}</span>
                                        {rec.status === 'cancelled' && (
                                            <span className="block text-xs font-semibold text-[var(--color-accent)]" title={rec.cancellation_reason || ''}>ยกเลิกแล้ว</span>
                                        )}
                                    </td>
                                    <td className="p-3 tabular-nums">
                                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${rec.form_type === 'PND53' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {rec.form_type}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <div className="font-semibold text-[oklch(18%_0.012_28)]">{rec.payee_name}</div>
                                        {rec.notes && <div className="text-xs text-[oklch(50%_0.010_28)]">{rec.notes}</div>}
                                    </td>
                                    <td className="p-3 tabular-nums">{formatTaxId(rec.payee_tax_id)}</td>
                                    <td className="p-3 font-medium text-[oklch(42%_0.010_28)]">{rec.income_type}</td>
                                    <td className="p-3 text-right tabular-nums">{rec.tax_rate}%</td>
                                    <td className="p-3 text-right tabular-nums font-semibold">
                                        {Number(rec.gross_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right tabular-nums font-bold text-[oklch(52%_0.16_28)]">
                                        {Number(rec.tax_withheld || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right tabular-nums font-bold text-[oklch(18%_0.012_28)]">
                                        {Number(rec.net_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button
                                                onClick={() => setActivePrintRecord(rec)}
                                                className="p-1 text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] transition-colors cursor-pointer"
                                                title="พิมพ์ใบ 50 ทวิ"
                                            >
                                                <Printer size={15} />
                                            </button>
                                            {rec.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => handleCancelRecord(rec.id, rec.doc_number)}
                                                    className="p-1 text-[oklch(50%_0.010_28)] hover:text-red-600 transition-colors cursor-pointer"
                                                    title="ยกเลิกเอกสาร"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredRecords.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="p-12 text-center text-[oklch(50%_0.010_28)] tabular-nums">
                                        ไม่พบรายการภาษีหัก ณ ที่จ่ายในเดือนที่เลือก
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create WHT Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[170] flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-[#ECECE9] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-[#D1D1CD] font-sans text-xs">
                        <div className="bg-[#1A1A1A] text-[oklch(97%_0.008_28)] p-4 flex items-center justify-between">
                            <h3 className="tabular-nums font-bold text-sm ">
                                บันทึกภาษีหัก ณ ที่จ่าย & ออกหนังสือรับรอง 50 ทวิ
                            </h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-1 text-[oklch(97%_0.008_28)] hover:bg-white/10 rounded cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto bg-[oklch(99%_0.004_28)]">
                            {/* Payee Type Radio */}
                            <div className="flex gap-4 border-b border-[oklch(90%_0.008_28)] pb-3">
                                <label className="flex items-center gap-2 cursor-pointer font-bold">
                                    <input
                                        type="radio"
                                        checked={payeeType === 'company'}
                                        onChange={() => handlePayeeTypeChange('company')}
                                        className="accent-[oklch(52%_0.16_28)]"
                                    />
                                    <span>นิติบุคคล (ภ.ง.ด. 53)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer font-bold">
                                    <input
                                        type="radio"
                                        checked={payeeType === 'individual'}
                                        onChange={() => handlePayeeTypeChange('individual')}
                                        className="accent-[oklch(52%_0.16_28)]"
                                    />
                                    <span>บุคคลธรรมดา (ภ.ง.ด. 3)</span>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div className="sm:col-span-2">
                                    <label className="tabular-nums font-bold text-xs text-[oklch(50%_0.010_28)] block mb-1">
                                        ชื่อผู้รับเงิน / ผู้ถูกหักภาษี *
                                    </label>
                                    <input
                                        type="text"
                                        value={payeeName}
                                        onChange={(e) => setPayeeName(e.target.value)}
                                        placeholder="เช่น บริษัท รักษาความปลอดภัย จำกัด หรือ นายสมชาย ใจดี"
                                        className="w-full px-3 py-2 border border-[oklch(85%_0.012_28)] rounded-lg text-xs font-semibold focus:border-zinc-900 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="tabular-nums font-bold text-xs text-[oklch(50%_0.010_28)] block mb-1">
                                        เลขประจำตัวผู้เสียภาษี 13 หลัก
                                    </label>
                                    <input
                                        type="text"
                                        value={payeeTaxId}
                                        onChange={(e) => setPayeeTaxId(e.target.value)}
                                        placeholder="01055xxxxxxxx"
                                        maxLength={17}
                                        className="w-full px-3 py-2 border border-[oklch(85%_0.012_28)] rounded-lg tabular-nums text-xs focus:border-zinc-900 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="tabular-nums font-bold text-xs text-[oklch(50%_0.010_28)] block mb-1">
                                        วันที่จ่ายเงิน
                                    </label>
                                    <input
                                        type="date"
                                        value={paymentDate}
                                        onChange={(e) => setPaymentDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-[oklch(85%_0.012_28)] rounded-lg tabular-nums text-xs focus:border-zinc-900 focus:outline-none"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="tabular-nums font-bold text-xs text-[oklch(50%_0.010_28)] block mb-1">
                                        ที่อยู่ผู้ถูกหักภาษี
                                    </label>
                                    <input
                                        type="text"
                                        value={payeeAddress}
                                        onChange={(e) => setPayeeAddress(e.target.value)}
                                        placeholder="ที่อยู่ตาม ภ.พ.20 หรือ ทะเบียนบ้าน"
                                        className="w-full px-3 py-2 border border-[oklch(85%_0.012_28)] rounded-lg text-xs focus:border-zinc-900 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="tabular-nums font-bold text-xs text-[oklch(50%_0.010_28)] block mb-1">
                                        ประเภทเงินได้ที่จ่าย
                                    </label>
                                    <select
                                        value={incomeType}
                                        onChange={handleIncomeTypeChange}
                                        className="w-full px-3 py-2 border border-[oklch(85%_0.012_28)] rounded-lg text-xs focus:border-zinc-900 focus:outline-none bg-[oklch(99%_0.004_28)] font-medium"
                                    >
                                        <option value="ค่าบริการ 3%">ค่าบริการ 3%</option>
                                        <option value="ค่าจ้างทำของ 3%">ค่าจ้างทำของ 3%</option>
                                        <option value="ค่าเช่าทรัพย์สิน 5%">ค่าเช่าสถานที่ / ทรัพย์สิน 5%</option>
                                        <option value="ค่าโฆษณา 2%">ค่าโฆษณา 2%</option>
                                        <option value="ค่าขนส่ง 1%">ค่าขนส่ง 1%</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="tabular-nums font-bold text-xs text-[oklch(50%_0.010_28)] block mb-1">
                                        จำนวนเงินที่จ่าย (บาท) *
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={grossAmount}
                                        onChange={(e) => setGrossAmount(e.target.value)}
                                        placeholder="เช่น 10000"
                                        className="w-full px-3 py-2 border border-[oklch(85%_0.012_28)] rounded-lg tabular-nums text-xs font-bold focus:border-zinc-900 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Live Calculation Preview */}
                            {grossAmount && Number(grossAmount) > 0 && (
                                <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(90%_0.008_28)] rounded-xl p-3.5 space-y-1.5 tabular-nums text-xs">
                                    <div className="flex justify-between text-[oklch(42%_0.010_28)]">
                                        <span>จำนวนเงินจ่าย:</span>
                                        <span>฿{Number(grossAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-red-600 font-bold">
                                        <span>ภาษีหัก ณ ที่จ่าย {taxRate}%:</span>
                                        <span>-฿{((Number(grossAmount || 0) * taxRate) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-[oklch(18%_0.012_28)] font-black border-t border-[oklch(90%_0.008_28)] pt-1.5 text-sm">
                                        <span>ยอดจ่ายสุทธิ:</span>
                                        <span className="text-emerald-700">฿{(Number(grossAmount || 0) - ((Number(grossAmount || 0) * taxRate) / 100)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-[oklch(94%_0.010_28)] border-t border-[oklch(85%_0.012_28)] flex justify-end gap-2">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 border border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] rounded-lg tabular-nums font-bold text-xs hover:bg-[oklch(90%_0.008_28)] cursor-pointer"
                            >
                                ยกเลิก
                            </button>
                            <button
                                disabled={saving}
                                onClick={handleSaveWht}
                                className="px-5 py-2 bg-[#1A1A1A] hover:bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] rounded-lg tabular-nums font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                            >
                                <Save size={14} />
                                <span>{saving ? 'กำลังบันทึก...' : 'บันทึกรายการ'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Printable 50 ทวิ Modal */}
            {activePrintRecord && (
                <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-950/80 backdrop-blur-md items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-[oklch(99%_0.004_28)]">
                    <div className="w-full max-w-3xl bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-6 py-3 border border-zinc-700 flex justify-between items-center tabular-nums text-xs mb-3 print:hidden shadow-2xl">
                        <span>[ หนังสือรับรองการหักภาษี ณ ที่จ่าย 50 ทวิ // #{activePrintRecord.doc_number} ]</span>
                        <div className="flex gap-2">
                            <button
                                disabled={whtPdfBusy}
                                onClick={async () => {
                                    const sheet = document.getElementById('wht-50-tavi-printable-sheet');
                                    if (!sheet || whtPdfBusy) return;
                                    setWhtPdfBusy(true);
                                    try {
                                        const fileName = `WHT_50_TAVI_${activePrintRecord.doc_number}.pdf`;
                                        const { blob } = await generateTaxDocumentPdf(sheet, { fileName });
                                        downloadTaxPdf(blob, fileName);
                                        toast.success('ดาวน์โหลดหนังสือ 50 ทวิ เรียบร้อยแล้ว');
                                    } catch (pdfErr) {
                                        toast.error('สร้าง PDF ไม่สำเร็จ: ' + (pdfErr?.message || 'ลองใหม่อีกครั้ง'));
                                    } finally {
                                        setWhtPdfBusy(false);
                                    }
                                }}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-[oklch(97%_0.008_28)] font-bold rounded flex items-center gap-1.5 cursor-pointer text-xs"
                            >
                                <Download size={14} />
                                <span>ดาวน์โหลด PDF</span>
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-[oklch(97%_0.008_28)] font-bold rounded flex items-center gap-1.5 cursor-pointer text-xs"
                            >
                                <Printer size={14} />
                                <span>พิมพ์ใบ 50 ทวิ</span>
                            </button>
                            <button
                                onClick={() => setActivePrintRecord(null)}
                                className="px-3 py-1.5 border border-zinc-700 text-[oklch(97%_0.008_28)] rounded hover:bg-white/10 cursor-pointer"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* A4 50 ทวิ Certificate Sheet */}
                    <div 
                        id="wht-50-tavi-printable-sheet"
                        style={{ fontFamily: "'IBM Plex Sans Thai', 'Sarabun', 'Leelawadee', system-ui, -apple-system, sans-serif" }}
                        className="print-page-sheet w-[794px] min-w-[794px] self-start md:self-center print:w-full print:min-w-0 bg-[oklch(99%_0.004_28)] text-[oklch(18%_0.012_28)] p-10 border border-[oklch(85%_0.012_28)] shadow-2xl text-[11.5pt] print:m-0 print:p-8 print:border-none print:shadow-none space-y-4"
                    >
                        <div className="text-center border-b-2 border-zinc-950 pb-3.5">
                            <h1 className="font-bold text-[20pt] text-[oklch(18%_0.012_28)] leading-tight">
                                หนังสือรับรองการหักภาษี ณ ที่จ่าย
                            </h1>
                            <p className="tabular-nums text-[11.5pt] text-[oklch(42%_0.010_28)] mt-0.5 font-medium">
                                ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร (แบบยื่น {activePrintRecord.form_type})
                            </p>
                            <span className="tabular-nums text-[11.5pt] font-bold text-[oklch(18%_0.012_28)] block mt-1">
                                เลขที่เอกสาร: {activePrintRecord.doc_number} • วันที่: {activePrintRecord.payment_date}
                            </span>
                        </div>

                        {/* Payer Box */}
                        <div className="border-2 border-zinc-950 p-3.5 bg-[oklch(97%_0.008_28)] space-y-1 tabular-nums text-[11.5pt]">
                            <span className="font-bold text-[oklch(42%_0.010_28)] text-[10pt] block">1. ผู้มีหน้าที่หักภาษี ณ ที่จ่าย:</span>
                            <div className="font-bold text-[14pt] text-[oklch(18%_0.012_28)]">{companySettings?.tax_company_name || 'ร้านในบ้าน นครพนม'}</div>
                            <div>เลขประจำตัวผู้เสียภาษี: <strong className="text-[oklch(18%_0.012_28)] font-bold">{formatTaxId(companySettings?.tax_id)}</strong></div>
                            <div>ที่อยู่: {companySettings?.tax_address || '788/1 สุนทรวิจิตร ในเมือง เมืองนครพนม 48000'}</div>
                        </div>

                        {/* Payee Box */}
                        <div className="border-2 border-zinc-950 p-3.5 bg-[oklch(99%_0.004_28)] space-y-1 tabular-nums text-[11.5pt]">
                            <span className="font-bold text-[oklch(42%_0.010_28)] text-[10pt] block">2. ผู้ถูกหักภาษี ณ ที่จ่าย:</span>
                            <div className="font-bold text-[14pt] text-[oklch(18%_0.012_28)]">{activePrintRecord.payee_name}</div>
                            <div>เลขประจำตัวผู้เสียภาษี: <strong className="text-[oklch(18%_0.012_28)] font-bold">{formatTaxId(activePrintRecord.payee_tax_id)}</strong></div>
                            <div>ที่อยู่: {activePrintRecord.payee_address || '-'}</div>
                        </div>

                        {/* Table of Income & Tax */}
                        <table className="w-full border-collapse border-2 border-zinc-950 text-[11.5pt]">
                            <thead>
                                <tr className="bg-[oklch(94%_0.010_28)] border-b-2 border-zinc-950 tabular-nums text-[11pt] font-bold text-[oklch(18%_0.012_28)] ">
                                    <th className="p-2.5 border-r border-zinc-950 text-left">ประเภทเงินได้พึงประเมินที่จ่าย</th>
                                    <th className="p-2.5 border-r border-zinc-950 w-28 text-center">วันเดือนปีที่จ่าย</th>
                                    <th className="p-2.5 border-r border-zinc-950 w-32 text-right">จำนวนเงินที่จ่าย</th>
                                    <th className="p-2.5 w-32 text-right">ภาษีที่หักและนำส่ง</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-[oklch(85%_0.012_28)]">
                                    <td className="p-2.5 border-r border-zinc-950 font-medium text-[oklch(18%_0.012_28)]">{activePrintRecord.income_type}</td>
                                    <td className="p-2.5 border-r border-zinc-950 text-center tabular-nums">{activePrintRecord.payment_date}</td>
                                    <td className="p-2.5 border-r border-zinc-950 text-right tabular-nums font-semibold">{Number(activePrintRecord.gross_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    <td className="p-2.5 text-right tabular-nums font-bold text-[oklch(52%_0.16_28)]">{Number(activePrintRecord.tax_withheld).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr className="bg-[oklch(94%_0.010_28)] tabular-nums font-bold text-[12pt] text-[oklch(18%_0.012_28)] border-t-2 border-zinc-950">
                                    <td colSpan={2} className="p-2.5 border-r border-zinc-950 text-right">รวมเงินภาษีที่หักและนำส่ง:</td>
                                    <td className="p-2.5 border-r border-zinc-950 text-right">฿{Number(activePrintRecord.gross_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    <td className="p-2.5 text-right">฿{Number(activePrintRecord.tax_withheld).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* Baht Text */}
                        <div className="border-2 border-zinc-950 p-3 bg-[oklch(97%_0.008_28)] tabular-nums text-[11.5pt]">
                            <span className="text-[oklch(42%_0.010_28)]">จำนวนเงินภาษีที่หักและนำส่ง (ตัวอักษร): </span>
                            <strong className="text-[oklch(18%_0.012_28)] font-bold text-[12.5pt]">({thaiBahtText(activePrintRecord.tax_withheld)})</strong>
                        </div>

                        {/* Signatures */}
                        <div className="pt-8 grid grid-cols-2 gap-8 tabular-nums text-xs text-center">
                            <div>
                                <div className="w-48 border-b border-zinc-900 mx-auto pb-8 mb-2"></div>
                                <div>ผู้จ่ายเงิน / ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</div>
                                <div className="text-xs text-[oklch(50%_0.010_28)]">วันที่: {activePrintRecord.payment_date}</div>
                            </div>
                            <div>
                                <div className="w-48 border-b border-zinc-900 mx-auto pb-8 mb-2"></div>
                                <div>ประทับตรานิติบุคคล (ถ้ามี)</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
