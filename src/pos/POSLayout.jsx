import React, { useState, useEffect } from 'react';
import { 
    LayoutGrid, 
    UtensilsCrossed, 
    Users, 
    Settings, 
    LogOut,
    ChevronLeft,
    Clock,
    BarChart3,
    ShoppingBag
} from 'lucide-react';
import { isOnline, getOfflineQueue, syncOfflineQueue } from '../utils/offlineHelper';
import { getCurrentShift } from '../utils/shiftHelper';

export default function POSLayout({ children, activeView, onViewChange, selectedTable, onBack }) {
    const [online, setOnline] = useState(isOnline());
    const [queueLength, setQueueLength] = useState(getOfflineQueue().length);
    const [activeShift, setActiveShift] = useState(getCurrentShift());

    useEffect(() => {
        const handleStatus = () => setOnline(isOnline());
        const handleQueue = () => setQueueLength(getOfflineQueue().length);
        const handleShift = () => setActiveShift(getCurrentShift());

        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        window.addEventListener('offline-queue-changed', handleQueue);
        window.addEventListener('pos-shift-changed', handleShift);

        // Auto trigger sync on mount if online and queue has items
        if (isOnline() && getOfflineQueue().length > 0) {
            syncOfflineQueue();
        }

        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
            window.removeEventListener('offline-queue-changed', handleQueue);
            window.removeEventListener('pos-shift-changed', handleShift);
        };
    }, []);
    return (
        <div className="flex h-full w-full bg-[#ECECE9] text-[#1A1A1A] font-sans overflow-hidden">
            {/* Narrow Sidebar for Navigation */}
            <aside className="w-24 bg-[#F5F5F2] border-r border-[#D1D1CD] flex flex-col items-center py-4 justify-between select-none shrink-0">
                <div className="flex flex-col items-center gap-4 w-full">
                    {/* Brand Logo */}
                    <div className="w-12 h-12 flex flex-col items-center justify-center border border-[#D1D1CD] rounded-full bg-white shadow-sm select-none overflow-hidden p-1.5 bg-white">
                        <img 
                            src="/logo.png" 
                            alt="Haus Table" 
                            className="w-full h-full object-contain grayscale-[10%]"
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
                            icon={ShoppingBag} 
                            active={activeView === 'pickup'} 
                            onClick={() => onViewChange('pickup')} 
                            label="Pick-up"
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
                    <NavIcon icon={Clock} onClick={() => window.location.href = '/staff/orders'} label="Live Orders" />
                    <NavIcon icon={Settings} onClick={() => window.location.href = '/admin/settings'} label="Settings" />
                    <NavIcon icon={LogOut} onClick={() => window.location.href = '/'} label="Exit" />
                    
                    {/* Subtle Side Branding */}
                    <div className="mt-3 [writing-mode:vertical-lr] text-[8px] font-mono font-bold tracking-widest text-[#767673] uppercase select-none opacity-50 text-center">
                        ONHAUS ©
                    </div>
                </div>
            </aside>

            {/* Main Content wrapper */}
            <div className="flex-1 flex flex-col overflow-hidden">
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
                             activeView === 'pickup' ? 'PICK-UP ORDERS' :
                             activeView === 'menu' ? (selectedTable ? `ORDER ENTRY : ${selectedTable.table_name}` : 'ORDER ENTRY : DIRECT BILL') : 
                             activeView === 'reports' ? 'REPORTS & SHIFT LOG' : 
                             'CUSTOMER CRM'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Offline Sync Status Badge */}
                        {!online ? (
                            <div className="flex items-center gap-1.5 bg-red-100 border border-red-200 text-red-700 font-mono text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-sm animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                <span>OFFLINE MODE ({queueLength} PENDING)</span>
                            </div>
                        ) : queueLength > 0 ? (
                            <button
                                onClick={syncOfflineQueue}
                                className="flex items-center gap-1.5 bg-amber-100 border border-amber-200 text-amber-700 font-mono text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full hover:bg-amber-200 cursor-pointer active:scale-95 transition-all shadow-sm"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                                <span>SYNC PENDING ({queueLength})</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-emerald-100 border border-emerald-200 text-emerald-700 font-mono text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span>ONLINE</span>
                            </div>
                        )}
                        
                        {/* Active Shift Employee */}
                        {activeShift && (
                            <div className="flex items-center gap-1.5 bg-[#ff0000]/10 border border-[#ff0000]/20 text-[#ff0000] px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm">
                                <Users size={12} />
                                <span>พนักงาน: {activeShift.staffName}</span>
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
                                    className="ml-1 text-[10px] uppercase font-black hover:text-[#c00000] border-l border-[#ff0000]/30 pl-2 cursor-pointer transition-colors"
                                >
                                    ปิดรอบ
                                </button>
                            </div>
                        )}

                        {/* Sub-Branding */}
                        <span className="text-[10px] font-mono font-bold tracking-widest text-[#767673] uppercase select-none hidden md:inline">
                            ONHAUS SYSTEM ©
                        </span>
                        
                        <div className="flex items-center gap-2 text-[#767673] text-xs bg-white border border-[#D1D1CD] px-3 py-1.5 rounded-full font-mono font-bold shadow-sm">
                            <Clock size={12} />
                            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-hidden bg-[#ECECE9]">
                    {children}
                </main>
            </div>
        </div>
    );
}

function NavIcon({ icon: Icon, active, onClick, label }) {
    return (
        <button 
            onClick={onClick}
            className={`group relative flex flex-col items-center justify-center w-full py-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                active 
                ? 'bg-[#E0E0DC] border-[#B0B0AC] shadow-inner font-bold' 
                : 'bg-white hover:bg-[#FDFDFD] border-[#D1D1CD] shadow-sm hover:border-[#B0B0AC]'
            }`}
        >
            <Icon size={16} className={active ? 'text-[#1A1A1A]' : 'text-[#767673]'} strokeWidth={active ? 2.5 : 2} />
            
            <span className="text-[8px] font-mono font-bold tracking-wider uppercase mt-1 text-[#767673]">
                {label}
            </span>
            
            {/* Active Indicator LED Orange Dot */}
            {active && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#ff0000]"></span>
            )}
        </button>
    );
}
