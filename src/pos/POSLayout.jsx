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
import POSVolumeControl from './POSVolumeControl';

const POSLayout = memo(function POSLayout({ children, activeView, onViewChange, selectedTable, onBack, onlinePendingCount = 0 }) {
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
                    .maybeSingle();

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
        <div className="flex h-full w-full bg-[var(--color-paper)] text-[var(--color-ink)] font-sans overflow-hidden">
            {/* Structural Tabular Sidebar for Navigation */}
            <aside className="w-24 bg-[var(--color-paper-2)] border-r border-[var(--color-rule)] flex flex-col items-center py-4 justify-between select-none shrink-0">
                <div className="flex flex-col items-center gap-4 w-full">
                    <div className="w-12 h-12 flex flex-col items-center justify-center border border-[var(--color-rule)] rounded-md bg-[var(--color-paper)] shadow-xs select-none overflow-hidden">
                        <img 
                            src="/logo.png" 
                            alt="Haus Table" 
                            className="w-full h-full object-cover grayscale-[10%]"
                        />
                    </div>

                    <nav className="flex flex-col gap-2 w-full px-2 pt-2">
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
                            badge={onlinePendingCount}
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
                    <div className="mt-3 [writing-mode:vertical-lr] text-[8px] font-mono font-bold tracking-widest text-[var(--color-neutral)] uppercase select-none opacity-60 text-center">
                        ONHAUS ©
                    </div>
                </div>
            </aside>

            {/* Main Content wrapper */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Live Owner Announcement Banner */}
                {ownerAnnouncement && (
                    <div className="bg-[var(--color-ink)] text-[var(--color-paper)] px-6 py-2 flex items-center justify-between gap-4 font-mono text-xs border-b border-[var(--color-rule)] shrink-0 animate-in slide-in-from-top duration-200">
                        <div className="flex items-center gap-2.5 truncate">
                            <span className="bg-[var(--color-accent)] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-xs tracking-wider shrink-0">
                                OWNER BROADCAST
                            </span>
                            <span className="font-bold truncate text-[var(--color-paper)]">
                                "{ownerAnnouncement.text}"
                            </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] text-[var(--color-neutral)]">
                                {ownerAnnouncement.timestamp ? new Date(ownerAnnouncement.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            <button 
                                onClick={() => setOwnerAnnouncement(null)}
                                className="text-[var(--color-paper)] hover:text-white text-[10px] font-bold uppercase border border-[var(--color-rule)] hover:border-white px-2 py-0.5 rounded-xs transition-colors cursor-pointer"
                            >
                                รับทราบ
                            </button>
                        </div>
                    </div>
                )}

                {/* Header Sub-bar */}
                <header className="h-16 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4">
                        {selectedTable && (
                            <button 
                                onClick={onBack}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-md transition-colors bg-[var(--color-paper-2)] shadow-xs cursor-pointer touch-manipulation"
                                aria-label="ย้อนกลับ"
                            >
                                <ChevronLeft className="text-[var(--color-ink)]" size={18} />
                            </button>
                        )}
                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                            {activeView === 'tables' ? 'TABLE REGISTRY' : 
                             activeView === 'open_bills' ? 'OPEN BILLS REGISTRY / บิลเปิดอยู่ทั้งหมด' :
                             activeView === 'online_hub' ? 'ONLINE ORDERS HUB / ออเดอร์ออนไลน์' :
                             activeView === 'menu' ? (selectedTable ? `ORDER ENTRY : ${selectedTable.table_name}` : 'ORDER ENTRY : DIRECT BILL') : 
                             activeView === 'reports' ? 'REPORTS & SHIFT LOG' : 
                             'CUSTOMER CRM'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Offline Sync Status Badge */}
                        {!online ? (
                            <button
                                onClick={() => window.dispatchEvent(new Event('pos-trigger-offline-drawer'))}
                                className="min-h-[38px] flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-800 font-mono text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md shadow-xs animate-pulse cursor-pointer transition-all active:scale-95 touch-manipulation"
                            >
                                <span className="w-2 h-2 rounded-full bg-red-600"></span>
                                <span>🔴 ออฟไลน์ (ค้าง {queueLength} รายการ)</span>
                            </button>
                        ) : (Number(queueLength) || 0) > 0 ? (
                            <button
                                onClick={() => window.dispatchEvent(new Event('pos-trigger-offline-drawer'))}
                                className="min-h-[38px] flex items-center gap-1.5 bg-amber-50 border border-amber-300 text-amber-900 font-mono text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md hover:bg-amber-100 cursor-pointer active:scale-95 transition-all shadow-xs touch-manipulation"
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
                                <span>🟠 รอซิงค์ออนไลน์ ({queueLength} รายการ)</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => window.dispatchEvent(new Event('pos-trigger-offline-drawer'))}
                                className="min-h-[38px] flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-mono text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md shadow-xs cursor-pointer transition-all active:scale-95 touch-manipulation"
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                <span>🟢 ออนไลน์เรียบร้อย</span>
                            </button>
                        )}

                        {!hasSession && (
                            <button
                                onClick={() => window.location.href = '/login?redirect=/pos'}
                                className="min-h-[38px] flex items-center gap-1.5 bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-paper)] font-mono text-xs font-bold uppercase px-3.5 py-1.5 rounded-md shadow-xs cursor-pointer select-none active:scale-95 transition-all touch-manipulation"
                            >
                                <Users size={14} />
                                <span>เข้าสู่ระบบ LINE</span>
                            </button>
                        )}
                        
                        {/* Active Shift Employee */}
                        {(activeShift || activeStaff) && (
                            <div className="flex items-center gap-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] px-3.5 py-1.5 rounded-md text-xs font-bold font-mono shadow-xs">
                                <Users size={13} className="text-[var(--color-accent)]" />
                                <span>STAFF: {activeStaff?.display_name || activeShift?.staffName || 'Staff'}</span>
                                {activeShift && (
                                    <>
                                        <button 
                                            onClick={() => {
                                                window.dispatchEvent(new Event('pos-trigger-cash-adjustment'));
                                            }}
                                            className="ml-1 text-[10px] uppercase font-bold text-[var(--color-muted)] hover:text-[var(--color-ink)] border-l border-[var(--color-rule)] pl-2 cursor-pointer transition-colors touch-manipulation"
                                        >
                                            เบิกจ่าย
                                        </button>
                                        <button 
                                            onClick={() => {
                                                window.dispatchEvent(new Event('pos-trigger-close-shift'));
                                            }}
                                            className="ml-1 text-[10px] uppercase font-bold text-[var(--color-accent)] hover:opacity-80 border-l border-[var(--color-rule)] pl-2 cursor-pointer transition-colors touch-manipulation"
                                        >
                                            ปิดรอบ
                                        </button>
                                    </>
                                )}
                                <button 
                                    onClick={() => {
                                        window.dispatchEvent(new Event('pos-trigger-lock'));
                                    }}
                                    className="ml-1 text-[10px] uppercase font-bold text-[var(--color-neutral)] hover:text-[var(--color-ink)] border-l border-[var(--color-rule)] pl-2 cursor-pointer transition-colors touch-manipulation"
                                >
                                    สลับ
                                </button>
                            </div>
                        )}

                        {/* Sub-Branding */}
                        <span className="text-xs font-mono font-bold tracking-widest text-[var(--color-neutral)] uppercase select-none hidden md:inline">
                            ONHAUS SYSTEM ©
                        </span>
                        
                        {/* POS Audio Volume Control */}
                        <POSVolumeControl />

                        {/* Isolated Header Clock */}
                        <POSHeaderClock />
                    </div>
                </header>

                <main className="flex-1 overflow-hidden bg-[var(--color-paper)]">
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
        <div className="flex items-center gap-2 text-[var(--color-neutral)] text-xs bg-[var(--color-paper)] border border-[var(--color-rule)] px-3 py-1.5 rounded-md font-mono font-bold shadow-xs select-none">
            <Clock size={13} className="shrink-0 text-[var(--color-muted)]" />
            <span className="tabular-nums">{timeStr}</span>
        </div>
    );
});

export default POSLayout;

const NavIcon = memo(function NavIcon({ icon: Icon, active, onClick, label, badge = 0 }) {
    return (
        <button 
            type="button"
            onClick={onClick}
            style={{ transform: 'translateZ(0)' }}
            className={`group relative flex flex-col items-center justify-center w-full min-h-[52px] py-2.5 rounded-md border transition-colors duration-100 cursor-pointer select-none touch-manipulation active:scale-95 ${
                active 
                ? 'bg-[var(--color-paper)] border-[var(--color-accent)] font-bold text-[var(--color-ink)] shadow-xs' 
                : 'bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] shadow-xs'
            }`}
        >
            <Icon size={18} className={active ? 'text-[var(--color-accent)]' : 'text-[var(--color-neutral)]'} strokeWidth={active ? 2.5 : 1.75} />
            
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase mt-1">
                {label}
            </span>
            
            {/* Number Badge Notification */}
            {badge > 0 ? (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--color-accent)] text-white font-mono text-[9px] font-bold px-1 shadow-xs animate-pulse border border-[var(--color-paper)]">
                    {badge > 99 ? '99+' : badge}
                </span>
            ) : active ? (
                /* Active Indicator Accent Bar */
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-xs bg-[var(--color-accent)]"></span>
            ) : null}
        </button>
    );
});
