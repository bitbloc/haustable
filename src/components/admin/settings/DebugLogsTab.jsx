/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react';
import { Terminal, ShieldCheck, AlertTriangle, Copy, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { logger } from '../../../utils/logger';

export default function DebugLogsTab() {
    const logs = logger.getLogs();
    const crashLogs = logs.filter(l => l.level === 'CRASH');
    const hasSunmiCrash = crashLogs.some(l => l.title?.includes('print_sunmi'));

    const handleCopyLogs = () => {
        const logsText = JSON.stringify(logger.getLogs(), null, 2);
        navigator.clipboard.writeText(logsText);
        toast.success('คัดลอกประวัติข้อผิดพลาดไปที่ Clipboard สำเร็จ');
    };

    const handleClearLogs = () => {
        if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างประวัติบันทึกข้อผิดพลาดทั้งหมด?')) return;
        logger.clearLogs();
        toast.success('ล้างประวัติบันทึกสำเร็จ');
        window.location.reload();
    };

    return (
        <div className="space-y-6 font-mono text-[var(--color-ink)]">
            {/* Crash Diagnostics Card */}
            <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--color-rule)] pb-3">
                    <Terminal size={18} className="text-[var(--color-ink)]" />
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                            Crash Diagnostics (วิเคราะห์สาเหตุการหยุดทำงาน)
                        </h2>
                        <p className="text-[11px] text-[var(--color-neutral)]">
                            ตรวจสอบประวัติการขัดข้องทางฮาร์ดแวร์และการทำงานของระบบ
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    {hasSunmiCrash ? (
                        <div className="bg-[var(--color-paper)] border border-[var(--color-accent)] text-[var(--color-ink)] p-4 rounded-xl space-y-2">
                            <div className="flex items-center gap-2 font-bold text-xs uppercase text-[var(--color-accent)]">
                                <AlertTriangle size={16} />
                                ตรวจพบการขัดข้องจากเครื่องพิมพ์ SUNMI ในตัว (AIDL Crash)
                            </div>
                            <p className="text-xs leading-relaxed text-[var(--color-muted)]">
                                แอปพลิเคชันเคยหยุดทำงานกระทันหันระหว่างเรียกใช้เครื่องพิมพ์ SUNMI
                                มักเกิดจากความไม่เข้ากันของเฟิร์มแวร์หรือบริการระบบบนรุ่น Sunmi D2s Plus
                            </p>
                            <div className="text-[11px] bg-[var(--color-paper-2)] p-3 rounded-lg border border-[var(--color-rule)] space-y-1 text-[var(--color-ink)]">
                                <div className="font-bold">คำแนะนำในการแก้ไข:</div>
                                <div>1. เปิดแอป App Market บนเครื่อง Sunmi</div>
                                <div>2. ค้นหาและอัปเดต Sunmi Printer Service (หรือ WOYOU AIO Service) เป็นเวอร์ชันล่าสุด</div>
                                <div>3. รีสตาร์ตเครื่องเพื่อเริ่มต้นเซอร์วิสระบบใหม่</div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-4 rounded-xl space-y-1">
                            <div className="flex items-center gap-2 font-bold text-xs uppercase text-[var(--color-ink)]">
                                <ShieldCheck size={16} />
                                ระบบทำงานเป็นปกติ (No Native Crashes Detected)
                            </div>
                            <p className="text-xs text-[var(--color-neutral)] leading-relaxed">
                                ยังไม่ตรวจพบประวัติแอปพลิเคชันปิดตัวลงกระทันหันจากฮาร์ดแวร์ Native
                            </p>
                        </div>
                    )}

                    {/* Environment Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-3.5 rounded-xl space-y-1">
                            <div className="text-[10px] uppercase font-bold text-[var(--color-neutral)]">Environment Info</div>
                            <div>Platform: <span className="font-bold">{Capacitor.getPlatform()}</span></div>
                            <div>Native App: <span className="font-bold">{Capacitor.isNativePlatform() ? 'Yes' : 'No'}</span></div>
                        </div>
                        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-3.5 rounded-xl space-y-1">
                            <div className="text-[10px] uppercase font-bold text-[var(--color-neutral)]">Log Statistics</div>
                            <div>Total Logs: <span className="font-bold tabular-nums">{logs.length}</span></div>
                            <div>Crashes: <span className="font-bold text-[var(--color-accent)] tabular-nums">{crashLogs.length}</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Runtime Error Logs Panel */}
            <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-6 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--color-rule)] pb-3 gap-2">
                    <div className="flex items-center gap-2">
                        <FileText size={18} className="text-[var(--color-ink)]" />
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                            Runtime & Uncaught Logs (ประวัติข้อผิดพลาด)
                        </h2>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleCopyLogs}
                            className="bg-[var(--color-paper)] hover:bg-[var(--color-rule)] border border-[var(--color-rule)] text-[var(--color-ink)] px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            <Copy size={12} /> Copy Logs
                        </button>
                        <button
                            type="button"
                            onClick={handleClearLogs}
                            className="bg-[var(--color-paper)] hover:bg-[var(--color-rule)] border border-[var(--color-rule)] text-[var(--color-accent)] px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            <Trash2 size={12} /> Clear Logs
                        </button>
                    </div>
                </div>

                <div className="max-h-72 overflow-y-auto border border-[var(--color-rule)] rounded-xl bg-[var(--color-paper)] text-xs divide-y divide-[var(--color-rule)]">
                    {logs.length === 0 ? (
                        <div className="p-8 text-center text-[var(--color-neutral)] font-medium">
                            ไม่มีบันทึกประวัติข้อผิดพลาดในขณะนี้
                        </div>
                    ) : (
                        logs.slice().reverse().map(log => (
                            <div key={log.id} className="p-3 hover:bg-[var(--color-paper-2)] transition-colors">
                                <div className="flex justify-between items-start gap-2 mb-1">
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                                        {log.level}
                                    </span>
                                    <span className="text-[10px] text-[var(--color-neutral)]">{new Date(log.timestamp).toLocaleString('th-TH')}</span>
                                </div>
                                <div className="font-bold text-[var(--color-ink)]">{log.title}</div>
                                {log.details && (
                                    <pre className="mt-1 p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded text-[9px] text-[var(--color-muted)] overflow-x-auto whitespace-pre-wrap max-h-24">
                                        {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
