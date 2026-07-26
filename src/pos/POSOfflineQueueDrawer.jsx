import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Trash2, Database, AlertCircle, CheckCircle2, Clock, Layers } from 'lucide-react';
import { getOfflineQueue, saveOfflineQueue, syncOfflineQueue, isOnline } from '../utils/offlineHelper';
import { toast } from 'sonner';

export default function POSOfflineQueueDrawer({ isOpen, onClose }) {
    const [queue, setQueue] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);

    const refreshQueue = () => {
        setQueue(getOfflineQueue());
    };

    useEffect(() => {
        if (isOpen) {
            refreshQueue();
        }
        window.addEventListener('offline-queue-changed', refreshQueue);
        return () => {
            window.removeEventListener('offline-queue-changed', refreshQueue);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleManualSync = async () => {
        if (!isOnline()) {
            toast.error('❌ ไม่สามารถ Sync ได้เนื่องจากเครื่องยังออฟไลน์อยู่');
            return;
        }
        setIsSyncing(true);
        await syncOfflineQueue(true);
        refreshQueue();
        setIsSyncing(false);
    };

    const handleRemoveItem = (id) => {
        const updated = queue.filter(item => item.id !== id);
        saveOfflineQueue(updated);
        refreshQueue();
        toast.info('ลบรายการค้างออกจากเครื่องแล้ว');
    };

    const handleClearAll = () => {
        if (window.confirm('คุณต้องการลบรายการค้างออฟไลน์ทั้งหมดในเครื่องใช่หรือไม่? (ข้อมูลที่ไม่ถูกส่งเซิร์ฟเวอร์จะสูญหาย)')) {
            saveOfflineQueue([]);
            refreshQueue();
            toast.info('ล้างรายการค้างทั้งหมดแล้ว');
        }
    };

    const formatActionType = (type) => {
        switch (type) {
            case 'create_walkin': return { label: 'Walk-in Table', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
            case 'create_pickup': return { label: 'Walk-in Takeaway', bg: 'bg-blue-100 text-blue-800 border-blue-200' };
            case 'submit_items': return { label: 'Order Items', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
            case 'complete_checkout': return { label: 'Checkout & Paid', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
            case 'split_payment': return { label: 'Split Payment', bg: 'bg-cyan-100 text-cyan-800 border-cyan-200' };
            case 'attach_customer': return { label: 'Attach Member', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
            case 'move_table': return { label: 'Move Table', bg: 'bg-stone-100 text-stone-800 border-stone-200' };
            case 'merge_bills': return { label: 'Merge Bills', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
            default: return { label: type, bg: 'bg-gray-100 text-gray-800 border-gray-200' };
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end font-sans select-none animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[oklch(97%_0.008_28)] border-l border-[oklch(85%_0.012_28)] flex flex-col h-full shadow-2xl text-[oklch(18%_0.012_28)]">
                
                {/* Drawer Header */}
                <div className="p-5 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] border border-[oklch(52%_0.16_28)]/20 flex items-center justify-center">
                            <Database size={16} />
                        </div>
                        <div>
                            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                OFFLINE QUEUE INSPECTOR
                            </h2>
                            <p className="text-[10px] text-[oklch(55%_0.010_28)] font-mono">
                                รายการค้างในเครื่อง ({queue.length} รายการ)
                            </p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white border border-[oklch(85%_0.012_28)] flex items-center justify-center text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] transition-colors cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Queue Summary Status Banner */}
                <div className="p-4 bg-[oklch(97%_0.008_28)] border-b border-[oklch(85%_0.012_28)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isOnline() ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-xs font-mono font-bold uppercase tracking-wide">
                            {isOnline() ? 'ONLINE: READY TO SYNC' : 'OFFLINE MODE'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {queue.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                className="text-[10px] font-mono uppercase font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                            >
                                ล้างทั้งหมด
                            </button>
                        )}
                        <button
                            onClick={handleManualSync}
                            disabled={isSyncing || queue.length === 0}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold font-sans transition-all cursor-pointer shadow-sm ${
                                isSyncing || queue.length === 0
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                                : 'bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-[oklch(97%_0.008_28)] active:scale-95'
                            }`}
                        >
                            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                            <span>{isSyncing ? 'กำลัง Sync...' : 'SYNC NOW'}</span>
                        </button>
                    </div>
                </div>

                {/* Queue Item List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {queue.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <CheckCircle2 size={40} className="text-emerald-500 mb-3 opacity-80" strokeWidth={1.5} />
                            <p className="text-xs font-mono font-bold uppercase tracking-widest text-[oklch(18%_0.012_28)]">
                                ทุกรายการเชื่อมโยงครบถ้วน
                            </p>
                            <p className="text-[10px] text-[oklch(55%_0.010_28)] font-sans mt-1">
                                ไม่มีรายการค้างในเครื่องขณะนี้ ข้อมูลทั้งหมดถูกส่งไปยังระบบเซิร์ฟเวอร์แล้ว
                            </p>
                        </div>
                    ) : (
                        queue.map((item, index) => {
                            const badge = formatActionType(item.type);
                            const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            
                            return (
                                <div 
                                    key={item.id || index}
                                    className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3.5 shadow-xs flex flex-col gap-2 relative group hover:border-[oklch(52%_0.16_28)] transition-all"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-mono font-bold text-[oklch(55%_0.010_28)] bg-[oklch(94%_0.010_28)] px-1.5 py-0.5 rounded">
                                                #{index + 1}
                                            </span>
                                            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${badge.bg}`}>
                                                {badge.label}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-mono text-[oklch(55%_0.010_28)] flex items-center gap-1">
                                                <Clock size={10} />
                                                {timeStr}
                                            </span>
                                            <button
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="text-gray-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                                                title="ลบรายการนี้ออกจากคิว"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Action Details Summary */}
                                    <div className="text-xs font-mono text-[oklch(18%_0.012_28)] bg-[oklch(97%_0.008_28)] p-2 rounded border border-[oklch(85%_0.012_28)] overflow-x-auto text-[10px]">
                                        {item.payload?.tableId && <div>Table ID: {item.payload.tableId}</div>}
                                        {item.payload?.bookingId && <div>Booking ID: {item.payload.bookingId}</div>}
                                        {item.payload?.totalAmount !== undefined && <div>Amount: ฿{item.payload.totalAmount?.toLocaleString()}</div>}
                                        {item.payload?.items && <div>Items: {item.payload.items.length} รายการ</div>}
                                        {item.payload?.customerNote && <div>Note: {item.payload.customerNote}</div>}
                                        {item.payload?.paymentMethod && <div>Paid via: {item.payload.paymentMethod?.toUpperCase()}</div>}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Notice */}
                <div className="p-3 border-t border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[9px] font-mono text-[oklch(55%_0.010_28)] text-center uppercase tracking-wider">
                    ONHAUS STANDALONE POS SYSTEM © AUTOMATIC SYNC ACTIVE
                </div>

            </div>
        </div>
    );
}
