/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Search, 
    RefreshCw, 
    Download, 
    Filter, 
    Clock, 
    User, 
    Layers, 
    ArrowRightLeft, 
    Package, 
    ShieldCheck, 
    Receipt, 
    SlidersHorizontal,
    X,
    ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchUnifiedStaffAuditLogs, exportAuditLogsToCsv } from '../../utils/auditLogger';

export default function AdminStaffLogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Filters
    const [dateRange, setDateRange] = useState('7d'); // 'today', 'yesterday', '7d', '30d', 'all'
    const [selectedModule, setSelectedModule] = useState('all'); // 'all', 'pos', 'stock', 'shift', 'admin'
    const [selectedStaff, setSelectedStaff] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal inspection state
    const [inspectLog, setInspectLog] = useState(null);

    // Calculate start & end ISO dates based on preset
    const dateBoundaries = useMemo(() => {
        const now = new Date();
        const endIso = now.toISOString();

        if (dateRange === 'today') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            return { startDate: start.toISOString(), endDate: endIso };
        }
        if (dateRange === 'yesterday') {
            const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
            const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
            return { startDate: yStart.toISOString(), endDate: yEnd.toISOString() };
        }
        if (dateRange === '7d') {
            const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return { startDate: start.toISOString(), endDate: endIso };
        }
        if (dateRange === '30d') {
            const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return { startDate: start.toISOString(), endDate: endIso };
        }
        return { startDate: null, endDate: null };
    }, [dateRange]);

    const loadLogs = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            const data = await fetchUnifiedStaffAuditLogs({
                startDate: dateBoundaries.startDate,
                endDate: dateBoundaries.endDate,
                module: selectedModule,
                staffName: selectedStaff,
                search: searchTerm,
                limit: 300
            });
            setLogs(data);
        } catch (err) {
            console.error('[AdminStaffLogsPage] Error loading logs:', err);
            toast.error('ไม่สามารถดึงข้อมูลบันทึกกิจกรรมได้');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [dateBoundaries, selectedModule, selectedStaff, searchTerm]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    // Unique staff names for dropdown
    const availableStaffList = useMemo(() => {
        const names = new Set();
        logs.forEach(l => {
            if (l.staff_name && l.staff_name.trim() !== '') {
                names.add(l.staff_name.trim());
            }
        });
        return Array.from(names).sort();
    }, [logs]);

    // Statistical breakdown
    const stats = useMemo(() => {
        let stockCount = 0;
        let posCount = 0;
        let shiftCount = 0;
        let adminCount = 0;

        logs.forEach(l => {
            if (l.module === 'stock') stockCount++;
            else if (l.module === 'pos') posCount++;
            else if (l.module === 'shift') shiftCount++;
            else if (l.module === 'admin') adminCount++;
        });

        return {
            total: logs.length,
            stockCount,
            posCount,
            shiftCount,
            adminCount
        };
    }, [logs]);

    const handleExport = () => {
        if (logs.length === 0) {
            toast.warning('ไม่มีข้อมูลสำหรับส่งออก');
            return;
        }
        const nowStr = new Date().toISOString().split('T')[0];
        exportAuditLogsToCsv(logs, `staff_activity_audit_${dateRange}_${nowStr}.csv`);
        toast.success(`ส่งออกรายงาน ${logs.length} รายการเป็นไฟล์ Excel CSV เรียบร้อยแล้ว`);
    };

    const getModuleBadge = (mod) => {
        switch (mod) {
            case 'stock':
                return { label: 'คลังสต็อก', bg: 'bg-[oklch(92%_0.04_140)] text-[oklch(35%_0.12_140)] border-[oklch(80%_0.06_140)]' };
            case 'pos':
                return { label: 'POS & โต๊ะ', bg: 'bg-[oklch(93%_0.03_230)] text-[oklch(38%_0.12_230)] border-[oklch(82%_0.05_230)]' };
            case 'shift':
                return { label: 'กะ / เงินสด', bg: 'bg-[oklch(93%_0.04_300)] text-[oklch(38%_0.12_300)] border-[oklch(82%_0.06_300)]' };
            case 'admin':
                return { label: 'หลังบ้าน', bg: 'bg-[oklch(92%_0.05_28)] text-[oklch(40%_0.15_28)] border-[oklch(80%_0.08_28)]' };
            default:
                return { label: mod.toUpperCase(), bg: 'bg-[oklch(92%_0.01_28)] text-[oklch(35%_0.01_28)] border-[oklch(82%_0.01_28)]' };
        }
    };

    return (
        <div className="min-h-screen bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header Title Section */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[oklch(85%_0.012_28)] pb-5">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-mono text-[oklch(52%_0.16_28)] tracking-wider uppercase font-semibold">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Audit & Security Engine · 7-Day Observability</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[oklch(18%_0.012_28)] mt-1">
                            บันทึกการทำงานของพนักงานและระบบ (Staff Activity Logs)
                        </h1>
                        <p className="text-sm text-[oklch(45%_0.010_28)] mt-1">
                            รายงานความโปร่งใสแบบละเอียด: การปรับสต็อก, ย้ายโต๊ะ, รวมบิล, ยกเลิกรายการ, และการตั้งค่าหลังบ้าน
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => loadLogs(true)}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-xs font-medium transition-colors cursor-pointer"
                            title="รีเฟรชข้อมูลล่าสุด"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                            <span>รีเฟรช</span>
                        </button>
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[oklch(18%_0.012_28)] hover:bg-[oklch(25%_0.015_28)] text-[oklch(97%_0.008_28)] text-xs font-medium transition-colors shadow-sm cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>ส่งออก Excel CSV</span>
                        </button>
                    </div>
                </div>

                {/* Summary Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-4 shadow-sm">
                        <span className="text-xs font-mono text-[oklch(50%_0.010_28)] uppercase tracking-wider block">กิจกรรมทั้งหมด</span>
                        <div className="text-2xl font-bold font-mono text-[oklch(18%_0.012_28)] mt-1.5">{stats.total}</div>
                        <span className="text-[11px] text-[oklch(45%_0.010_28)] mt-1 block">ในรอบเวลาที่เลือก</span>
                    </div>

                    <div className="bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-4 shadow-sm">
                        <span className="text-xs font-mono text-[oklch(35%_0.12_140)] uppercase tracking-wider block">ปรับแก้สต็อก</span>
                        <div className="text-2xl font-bold font-mono text-[oklch(18%_0.012_28)] mt-1.5">{stats.stockCount}</div>
                        <span className="text-[11px] text-[oklch(45%_0.010_28)] mt-1 block">ตรวจนับ / รับเข้า / เบิกใช้</span>
                    </div>

                    <div className="bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-4 shadow-sm">
                        <span className="text-xs font-mono text-[oklch(38%_0.12_230)] uppercase tracking-wider block">POS & โต๊ะ</span>
                        <div className="text-2xl font-bold font-mono text-[oklch(18%_0.012_28)] mt-1.5">{stats.posCount}</div>
                        <span className="text-[11px] text-[oklch(45%_0.010_28)] mt-1 block">ย้ายโต๊ะ / รวมบิล / ยกเลิก</span>
                    </div>

                    <div className="bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-4 shadow-sm">
                        <span className="text-xs font-mono text-[oklch(38%_0.12_300)] uppercase tracking-wider block">กะ & เงินสด</span>
                        <div className="text-2xl font-bold font-mono text-[oklch(18%_0.012_28)] mt-1.5">{stats.shiftCount}</div>
                        <span className="text-[11px] text-[oklch(45%_0.010_28)] mt-1 block">เปิด-ปิดกะ / นำเงินเข้า-ออก</span>
                    </div>

                    <div className="col-span-2 sm:col-span-1 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-4 shadow-sm">
                        <span className="text-xs font-mono text-[oklch(52%_0.16_28)] uppercase tracking-wider block">หลังบ้านแอดมิน</span>
                        <div className="text-2xl font-bold font-mono text-[oklch(18%_0.012_28)] mt-1.5">{stats.adminCount}</div>
                        <span className="text-[11px] text-[oklch(45%_0.010_28)] mt-1 block">แก้ไขเมนู / ตั้งค่าระบบ</span>
                    </div>
                </div>

                {/* Filters & Search Toolbar */}
                <div className="bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-4 space-y-4 shadow-sm">
                    {/* Top Row: Date Presets & Module Filter Tabs */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[oklch(90%_0.010_28)] pb-3">
                        {/* Module Tabs */}
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { id: 'all', label: 'ทั้งหมด' },
                                { id: 'stock', label: 'สต็อกวัตถุดิบ' },
                                { id: 'pos', label: 'POS & โต๊ะ' },
                                { id: 'shift', label: 'กะ / เงินสด' },
                                { id: 'admin', label: 'หลังบ้านแอดมิน' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setSelectedModule(tab.id)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                                        selectedModule === tab.id
                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] shadow-sm'
                                            : 'bg-[oklch(95%_0.008_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(35%_0.010_28)]'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Date Preset Buttons */}
                        <div className="flex items-center gap-1 bg-[oklch(94%_0.010_28)] p-1 rounded-lg border border-[oklch(88%_0.012_28)]">
                            {[
                                { id: 'today', label: 'วันนี้' },
                                { id: 'yesterday', label: 'เมื่อวาน' },
                                { id: '7d', label: '7 วัน (Pro)' },
                                { id: '30d', label: '30 วัน' },
                                { id: 'all', label: 'ทั้งหมด' }
                            ].map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setDateRange(p.id)}
                                    className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
                                        dateRange === p.id 
                                            ? 'bg-[oklch(99%_0.005_28)] text-[oklch(18%_0.012_28)] font-semibold shadow-xs' 
                                            : 'text-[oklch(45%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Row: Search & Staff Selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-8 relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(50%_0.010_28)]" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="ค้นหา: ชื่อพนักงาน, เลขโต๊ะ (เช่น 04), ชื่อวัตถุดิบ, หรือคีย์เวิร์ด..."
                                className="w-full pl-9 pr-4 py-2 bg-[oklch(96%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[oklch(52%_0.16_28)] text-[oklch(18%_0.012_28)] placeholder:text-[oklch(55%_0.010_28)]"
                            />
                        </div>

                        <div className="sm:col-span-4 relative">
                            <select
                                value={selectedStaff}
                                onChange={(e) => setSelectedStaff(e.target.value)}
                                className="w-full px-3 py-2 bg-[oklch(96%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[oklch(52%_0.16_28)] text-[oklch(18%_0.012_28)] cursor-pointer"
                            >
                                <option value="all">พนักงานทั้งหมด (All Staff)</option>
                                {availableStaffList.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Main Data Table */}
                <div className="bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] rounded-xl overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="p-12 text-center text-sm text-[oklch(50%_0.010_28)]">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[oklch(52%_0.16_28)] mb-3"></div>
                            <p>กำลังเรียกประวัติบันทึกการทำงานของพนักงาน...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-12 text-center text-sm text-[oklch(50%_0.010_28)]">
                            <p className="font-medium text-base text-[oklch(35%_0.012_28)]">ไม่พบประวัติกิจกรรมตามเงื่อนไขที่เลือก</p>
                            <p className="text-xs text-[oklch(55%_0.010_28)] mt-1">ลองเปลี่ยนช่วงเวลา หรือเลือกหมวดหมู่อื่นเพื่อดูข้อมูล</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[oklch(95%_0.010_28)] border-b border-[oklch(85%_0.012_28)] text-[oklch(40%_0.010_28)] font-mono uppercase tracking-wider">
                                        <th className="py-3 px-4 font-semibold w-40">วัน / เวลา</th>
                                        <th className="py-3 px-4 font-semibold w-36">พนักงาน</th>
                                        <th className="py-3 px-4 font-semibold w-28">หมวดหมู่</th>
                                        <th className="py-3 px-4 font-semibold">รายละเอียดกิจกรรม</th>
                                        <th className="py-3 px-4 font-semibold text-right w-36">ข้อมูล / ยอดเงิน</th>
                                        <th className="py-3 px-4 font-semibold text-center w-24">การจัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[oklch(90%_0.010_28)]">
                                    {logs.map((log) => {
                                        const badge = getModuleBadge(log.module);
                                        const dateObj = new Date(log.created_at);
                                        const formattedTime = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                        const formattedDate = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

                                        return (
                                            <tr key={log.id} className="hover:bg-[oklch(97%_0.008_28)] transition-colors">
                                                {/* Date & Time */}
                                                <td className="py-3 px-4 font-mono text-[oklch(35%_0.012_28)] whitespace-nowrap">
                                                    <div className="font-semibold">{formattedTime}</div>
                                                    <div className="text-[10px] text-[oklch(55%_0.010_28)]">{formattedDate}</div>
                                                </td>

                                                {/* Staff Name */}
                                                <td className="py-3 px-4 font-medium text-[oklch(18%_0.012_28)] whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-6 h-6 rounded-full bg-[oklch(92%_0.02_28)] border border-[oklch(85%_0.012_28)] flex items-center justify-center text-[10px] font-mono font-bold text-[oklch(35%_0.012_28)]">
                                                            {log.staff_name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="truncate max-w-[110px]" title={log.staff_name}>
                                                            {log.staff_name}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Module Badge */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${badge.bg}`}>
                                                        {badge.label}
                                                    </span>
                                                </td>

                                                {/* Description */}
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-[oklch(18%_0.012_28)]">
                                                        {log.title}
                                                    </div>
                                                    {log.description && (
                                                        <div className="text-[11px] text-[oklch(45%_0.010_28)] mt-0.5 line-clamp-1">
                                                            {log.description}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Amount / Impact */}
                                                <td className="py-3 px-4 text-right font-mono font-semibold whitespace-nowrap">
                                                    {log.amount > 0 ? (
                                                        <span className="text-[oklch(18%_0.012_28)]">
                                                            ฿{Number(log.amount).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                        </span>
                                                    ) : log.metadata?.quantity_change ? (
                                                        <span className={log.metadata.quantity_change > 0 ? 'text-[oklch(45%_0.15_140)]' : 'text-[oklch(52%_0.16_28)]'}>
                                                            {log.metadata.quantity_change > 0 ? '+' : ''}{log.metadata.quantity_change} {log.metadata.unit || ''}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[oklch(60%_0.010_28)] text-[11px] font-normal">-</span>
                                                    )}
                                                </td>

                                                {/* Action Button */}
                                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                                    <button
                                                        onClick={() => setInspectLog(log)}
                                                        className="px-2.5 py-1 text-[11px] font-medium text-[oklch(35%_0.012_28)] bg-[oklch(95%_0.008_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded transition-colors cursor-pointer"
                                                    >
                                                        ดูเจาะลึก
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer Insight */}
                <div className="text-xs text-[oklch(50%_0.010_28)] text-center py-2">
                    <span>💡 ข้อมูลบันทึกประวัติการทำงาน (Audit Trail) ทั้งหมดจัดเก็บอย่างปลอดภัยบน Supabase Pro Plan พร้อมระบบตรวจสอบย้อนหลัง 7 วัน</span>
                </div>

            </div>

            {/* Inspection Detail Modal */}
            {inspectLog && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                    <div className="bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-[oklch(88%_0.012_28)] flex items-center justify-between bg-[oklch(96%_0.008_28)]">
                            <div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-[oklch(52%_0.16_28)] font-semibold">
                                    Audit Detail Inspection
                                </span>
                                <h3 className="text-base font-bold text-[oklch(18%_0.012_28)] mt-0.5">
                                    {inspectLog.title}
                                </h3>
                            </div>
                            <button
                                onClick={() => setInspectLog(null)}
                                className="p-1.5 rounded-lg hover:bg-[oklch(90%_0.012_28)] text-[oklch(40%_0.010_28)] cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-5 space-y-4 overflow-y-auto text-xs">
                            {/* Metadata Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[oklch(96%_0.008_28)] p-3 rounded-lg border border-[oklch(88%_0.012_28)] font-mono">
                                <div>
                                    <span className="text-[10px] text-[oklch(50%_0.010_28)] uppercase block">วัน-เวลา</span>
                                    <span className="font-semibold text-[oklch(20%_0.012_28)]">
                                        {new Date(inspectLog.created_at).toLocaleString('th-TH')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-[oklch(50%_0.010_28)] uppercase block">พนักงานผู้ปฏิบัติการ</span>
                                    <span className="font-semibold text-[oklch(20%_0.012_28)]">{inspectLog.staff_name}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-[oklch(50%_0.010_28)] uppercase block">หมวดหมู่ระบบ</span>
                                    <span className="font-semibold uppercase text-[oklch(20%_0.012_28)]">{inspectLog.module}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-[oklch(50%_0.010_28)] uppercase block">Action Type</span>
                                    <span className="font-semibold text-[oklch(20%_0.012_28)]">{inspectLog.action_type}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-[oklch(50%_0.010_28)] uppercase block">ยอดเงิน / การเปลี่ยนแปลง</span>
                                    <span className="font-semibold text-[oklch(20%_0.012_28)]">
                                        {inspectLog.amount ? `฿${inspectLog.amount}` : '-'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-[oklch(50%_0.010_28)] uppercase block">Source Table</span>
                                    <span className="font-semibold text-[oklch(20%_0.012_28)]">{inspectLog.source}</span>
                                </div>
                            </div>

                            {/* Note / Description */}
                            {inspectLog.description && (
                                <div>
                                    <span className="font-semibold text-[oklch(25%_0.012_28)] block mb-1">เหตุผลหรือคำอธิบาย:</span>
                                    <p className="p-3 bg-[oklch(97%_0.008_28)] border border-[oklch(88%_0.012_28)] rounded-lg text-[oklch(30%_0.012_28)]">
                                        {inspectLog.description}
                                    </p>
                                </div>
                            )}

                            {/* Raw Metadata JSON */}
                            <div>
                                <span className="font-semibold text-[oklch(25%_0.012_28)] block mb-1 font-mono">
                                    Raw Structured Context (JSON Metadata):
                                </span>
                                <pre className="p-3.5 bg-[oklch(15%_0.012_28)] text-[oklch(92%_0.015_28)] rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed border border-[oklch(30%_0.012_28)]">
                                    {JSON.stringify(inspectLog.metadata, null, 2)}
                                </pre>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 border-t border-[oklch(88%_0.012_28)] flex justify-end bg-[oklch(96%_0.008_28)]">
                            <button
                                onClick={() => setInspectLog(null)}
                                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-[oklch(25%_0.015_28)] transition-colors cursor-pointer"
                            >
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
