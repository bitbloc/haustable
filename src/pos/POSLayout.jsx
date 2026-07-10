import React from 'react';
import { 
    LayoutGrid, 
    UtensilsCrossed, 
    Users, 
    Settings, 
    LogOut,
    ChevronLeft,
    Clock,
    BarChart3
} from 'lucide-react';

export default function POSLayout({ children, activeView, onViewChange, selectedTable, onBack }) {
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
                             activeView === 'menu' ? (selectedTable ? `ORDER ENTRY : ${selectedTable.table_name}` : 'MENU REGISTRY') : 
                             activeView === 'reports' ? 'REPORTS & SHIFT LOG' : 
                             'CUSTOMER CRM'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Sub-Branding */}
                        <span className="text-[10px] font-mono font-bold tracking-widest text-[#767673] uppercase select-none">
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
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FF5500]"></span>
            )}
        </button>
    );
}
