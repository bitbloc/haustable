import React, { useState, useEffect, memo } from 'react';
import { 
    LayoutGrid, 
    UtensilsCrossed, 
    Users, 
    Settings, 
    LogOut, 
    ChevronLeft, 
    Clock, 
    BarChart3, 
    ReceiptText, 
    Globe 
} from 'lucide-react';
import { isOnline, getOfflineQueue, syncOfflineQueue } from '../utils/offlineHelper';
import { getCurrentShift } from '../utils/shiftHelper';
import { supabase } from '../lib/supabaseClient';

const POSLayout = memo(function POSLayout({ children, activeView, onViewChange, selectedTable, onBack }) {
    const [online, setOnline] = useState(isOnline());
    const [queueLength, setQueueLength] = useState(getOfflineQueue().length);
    const [activeShift, setActiveShift] = useState(getCurrentShift());
    const [hasSession, setHasSession] = useState(false);
    const [activeStaff, setActiveStaff] = useState(() => {
        try {
            const saved = localStorage.getItem('pos_active_staff');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const [ownerAnnouncement, setOwnerAnnouncement] = useState(null);

    useEffect(() => {
        const handleStatus = () => setOnline(isOnline());
        const handleQueue = () => setQueueLength(getOfflineQueue().length);
        const handleShift = () => {
            setActiveShift(getCurrentShift());
            try {
                const saved = localStorage.getItem('pos_active_staff');
                setActiveStaff(saved ? JSON.parse(saved) : null);
            } catch {
                setActiveStaff(null);
            }
        };

        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        window.addEventListener('offline-queue-changed', handleQueue);
        window.addEventListener('pos-shift-changed', handleShift);

        // Fetch current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setHasSession(!!session);
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setHasSession(!!session);
        });

        // Fetch current active owner announcement
        const fetchAnnouncement = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'pos_owner_broadcast')
                    .single();

                if (!error && data?.value) {
                    try {
                        setOwnerAnnouncement(JSON.parse(data.value));
                    } catch {
                        setOwnerAnnouncement({ text: data.value });
                    }
                }
            } catch {}
        };
        fetchAnnouncement();

        // Real-time listener for live owner broadcast
        const broadcastChannel = supabase
            .channel('pos-broadcast-live')
            .on('broadcast', { event: 'owner-announcement' }, ({ payload }) => {
                if (payload) {
                    setOwnerAnnouncement(payload);
                }
            })
            .on('broadcast', { event: 'owner-announcement-clear' }, () => {
                setOwnerAnnouncement(null);
            })
            .subscribe();

        // Auto trigger sync on mount if online and queue has items
        if (isOnline() && getOfflineQueue().length > 0) {
            syncOfflineQueue();
        }

        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
            window.removeEventListener('offline-queue-changed', handleQueue);
            window.removeEventListener('pos-shift-changed', handleShift);
            subscription.unsubscribe();
            supabase.removeChannel(broadcastChannel);
        };
    }, []);
    return (
        <div className="flex h-full w-full bg-[#ECECE9] text-[#1A1A1A] font-sans overflow-hidden">
            {/* Narrow Sidebar for Navigation */}
            <aside className="w-24 bg-[#F5F5F2] border-r border-[#D1D1CD] flex flex-col items-center py-4 justify-between select-none shrink-0">
                <div className="flex flex-col items-center gap-4 w-full">
                    <div className="w-12 h-12 flex flex-col items-center justify-center border border-[#D1D1CD] rounded-full bg-white shadow-sm select-none overflow-hidden">
                        <img 
                            src="/logo.png" 
                            alt="Haus Table" 
                            className="w-full h-full object-cover grayscale-[10%]"
                        />
                    </div>

                    <nav className="flex flex-col gap-2.5 w-full px-2 pt-2">
                        <NavIcon 
                            icon={LayoutGrid} 
                            active={activeView === 'tables'} 
                            onClick={() => onViewChange('tables')} 
                            label="Tables"
                        />
                        <NavIcon 
                            icon={UtensilsCrossed} 
                            active={activeView === 'menu'} 
                            onClick={() => onViewChange('menu')} 
                            label="Menu"
                        />
                        <NavIcon 
                            icon={ReceiptText} 
                            active={activeView === 'open_bills'} 
                            onClick={() => onViewChange('open_bills')} 
                            label="Open Bills"
                        />
                        <NavIcon 
                            icon={Globe} 
                            active={activeView === 'online_hub'} 
                            onClick={() => onViewChange('online_hub')} 
                            label="Online"
                        />
                        <NavIcon 
                            icon={Users} 
                            active={activeView === 'crm'} 
                            onClick={() => onViewChange('crm')} 
                            label="CRM"
                        />
                        <NavIcon 
                            icon={BarChart3} 
                            active={activeView === 'reports'} 
                            onClick={() => onViewChange('reports')} 
                            label="Reports"
                        />
                    </nav>
                </div>

                <div className="flex flex-col gap-2 w-full px-2 items-center">
                    <NavIcon icon={LayoutGrid} onClick={() => window.location.href = '/staff'} label="Staff DB" />
                    <NavIcon icon={Settings} onClick={() => window.location.href = '/admin/settings'} label="Settings" />
                    
                    {/* Subtle Side Branding */}
                    <div className="mt-3 [writing-mode:vertical-lr] text-[8px] font-mono font-bold tracking-widest text-[#767673] uppercase select-none opacity-50 text-center">
                        ONHAUS ©
                    </div>
                </div>
            </aside>

            {/* Main Content wrapper */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Live Owner Announcement Banner */}
                {ownerAnnouncement && (
                    <div className="bg-[oklch(18%_0.012_28)] text-white px-6 py-2 flex items-center justify-between gap-4 font-mono text-xs border-b border-black shadow-inner shrink-0 animate-in slide-in-from-top duration-200">
                        <div className="flex items-center gap-2.5 truncate">
                            <span className="bg-[oklch(52%_0.16_28)] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-xs tracking-wider shrink-0">
                                OWNER BROADCAST
                            </span>
                            <span className="font-bold truncate text-[oklch(96%_0.008_28)]">
                                "{ownerAnnouncement.text}"
                            </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] text-gray-400">
                                {ownerAnnouncement.timestamp ? new Date(ownerAnnouncement.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            <button 
                                onClick={() => setOwnerAnnouncement(null)}
                                className="text-gray-300 hover:text-white text-[10px] font-bold uppercase border border-gray-600 hover:border-white px-2 py-0.5 rounded-xs transition-colors"
                            >
                                รับทราบ
                            </button>
                        </div>
                    </div>
                )}

                {/* Header Sub-bar */}
                <header className="h-16 bg-[#F5F5F2] border-b border-[#D1D1CD] flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        {selectedTable && (
                            <button 
                                onClick={onBack}
                                className="p-2 hover:bg-[#E0E0DC] border border-[#D1D1CD] rounded-full transition-colors bg-white shadow-sm cursor-pointer"
                            >
                                <ChevronLeft className="text-[#1A1A1A]" size={16} />
                            </button>
                        )}
                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A]">
                            {activeView === 'tables' ? 'TABLE REGISTRY' : 
                             activeView === 'open_bills' ? 'OPEN BILLS REGISTRY / บิลเปิดอยู่ทั้งหมด' :
                             activeView === 'online_hub' ? 'ONLINE ORDERS HUB / ออเดอร์ออนไลน์' :
                             activeView === 'menu' ? (selectedTable ? `ORDER ENTRY : ${selectedTable.table_name}` : 'ORDER ENTRY : DIRECT BILL') : 
                             activeView === 'reports' ? 'REPORTS & SHIFT LOG' : 
                             'CUSTOMER CRM'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Offline Sync Status Badge */}
                        {!online ? (
                            <button
                                onClick={() => window.dispatchEvent(new Event('pos-trigger-offline-drawer'))}
                                className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 border border-red-200 text-red-700 font-mono text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-sm animate-pulse cursor-pointer transition-all active:scale-95"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                <span>🔴 ออฟไลน์ (ค้าง {queueLength} รายการ)</span>
                            </button>
                        ) : (Number(queueLength) || 0) > 0 ? (
                            <button
                                onClick={() => window.dispatchEvent(new Event('pos-trigger-offline-drawer'))}
                                className="flex items-center gap-1.5 bg-amber-100 border border-amber-200 text-amber-800 font-mono text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full hover:bg-amber-200 cursor-pointer active:scale-95 transition-all shadow-sm"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                                <span>🟠 รอซิงค์ออนไลน์ ({queueLength} รายการ)</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => window.dispatchEvent(new Event('pos-trigger-offline-drawer'))}
                                className="flex items-center gap-1.5 bg-emerald-100 hover:bg-emerald-200 border border-emerald-200 text-emerald-800 font-mono text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-sm cursor-pointer transition-all active:scale-95"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span>🟢 อัปเดตออนไลน์ครบแล้ว (0 รายการ)</span>
                            </button>
                        )}

                        {!hasSession && (
                            <button
                                onClick={() => window.location.href = '/login?redirect=/pos'}
                                className="flex items-center gap-1.5 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-[oklch(97%_0.008_28)] font-sans text-xs font-bold px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer select-none active:scale-95 transition-all"
                            >
                                <Users size={12} />
                                <span>เข้าสู่ระบบ LINE</span>
                            </button>
                        )}
                        
                        {/* Active Shift Employee */}
                        {(activeShift || activeStaff) && (
                            <div className="flex items-center gap-1.5 bg-[#ff0000]/10 border border-[#ff0000]/20 text-[#ff0000] px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm">
                                <Users size={12} />
                                <span>พนักงาน: {activeStaff?.display_name || activeShift?.staffName || 'Staff'}</span>
                                {activeShift && (
                                    <>
                                        <button 
                                            onClick={() => {
                                                window.dispatchEvent(new Event('pos-trigger-cash-adjustment'));
                                            }}
                                            className="ml-1 text-[10px] uppercase font-black hover:text-[#c00000] border-l border-[#ff0000]/30 pl-2 cursor-pointer transition-colors"
                                        >
                                            เบิกจ่าย
                                        </button>
                                        <button 
                                            onClick={() => {
                                                window.dispatchEvent(new Event('pos-trigger-close-shift'));
                                            }}
                                            className="ml-1 text-xs uppercase font-black hover:text-[#c00000] border-l border-[#ff0000]/30 pl-2 cursor-pointer transition-colors touch-manipulation"
                                        >
                                            ปิดรอบ
                                        </button>
                                    </>
                                )}
                                <button 
                                    onClick={() => {
                                        window.dispatchEvent(new Event('pos-trigger-lock'));
                                    }}
                                    className="ml-1 text-xs uppercase font-black hover:text-[#c00000] border-l border-[#ff0000]/30 pl-2 cursor-pointer transition-colors touch-manipulation"
                                >
                                    สลับพนักงาน
                                </button>
                            </div>
                        )}

                        {/* Sub-Branding */}
                        <span className="text-xs font-mono font-bold tracking-widest text-[#767673] uppercase select-none hidden md:inline">
                            ONHAUS SYSTEM ©
                        </span>
                        
                        {/* Isolated Header Clock (Ticks every second without re-rendering parent layout) */}
                        <POSHeaderClock />
                    </div>
                </header>

                <main className="flex-1 overflow-hidden bg-[#ECECE9]">
                    {children}
                </main>
            </div>
        </div>
    );
});

const POSHeaderClock = memo(function POSHeaderClock() {
    const [timeStr, setTimeStr] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeStr(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-2 text-[#767673] text-xs bg-white border border-[#D1D1CD] px-3.5 py-2 rounded-full font-mono font-bold shadow-sm select-none">
            <Clock size={14} className="shrink-0" />
            <span className="tabular-nums">{timeStr}</span>
        </div>
    );
});

export default POSLayout;

const NavIcon = memo(function NavIcon({ icon: Icon, active, onClick, label }) {
    return (
        <button 
            type="button"
            onClick={onClick}
            style={{ transform: 'translateZ(0)' }}
            className={`group relative flex flex-col items-center justify-center w-full py-3 rounded-xl border transition-colors duration-100 cursor-pointer select-none touch-manipulation active:scale-95 ${
                active 
                ? 'bg-[#E0E0DC] border-[#B0B0AC] shadow-inner font-bold' 
                : 'bg-white hover:bg-[#FDFDFD] border-[#D1D1CD] shadow-sm hover:border-[#B0B0AC]'
            }`}
        >
            <Icon size={20} className={active ? 'text-[#1A1A1A]' : 'text-[#767673]'} strokeWidth={active ? 2.5 : 2} />
            
            <span className="text-xs font-mono font-bold tracking-wider uppercase mt-1 text-[#1A1A1A]">
                {label}
            </span>
            
            {/* Active Indicator LED Accent Dot */}
            {active && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)]"></span>
            )}
        </button>
    );
});
