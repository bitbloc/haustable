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
        <div className="flex h-full w-full">
            {/* Narrow Sidebar for Navigation */}
            <aside className="w-20 bg-[#1A1A1A] border-r border-white/5 flex flex-col items-center py-6 gap-8">
                <div className="w-12 h-12 flex items-center justify-center">
                    <img src="/logo-staff-dark.png" alt="Staff Logo" className="w-12 h-12 object-contain" />
                </div>

                <nav className="flex flex-col gap-4 flex-1">
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

                <div className="flex flex-col gap-4">
                    <NavIcon icon={Settings} onClick={() => {}} label="Settings" />
                    <NavIcon icon={LogOut} onClick={() => window.location.href = '/staff'} label="Exit" />
                </div>
            </aside>

            {/* Main Content wrapper */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header Sub-bar */}
                <header className="h-16 bg-[#1A1A1A] border-b border-white/5 flex items-center justify-between px-6">
                    <div className="flex items-center gap-4">
                        {selectedTable && (
                            <button 
                                onClick={onBack}
                                className="p-2 hover:bg-white/5 rounded-full transition-colors"
                            >
                                <ChevronLeft className="text-gray-400" />
                            </button>
                        )}
                        <h2 className="text-lg font-bold">
                            {activeView === 'tables' ? 'Table Management' : 
                             activeView === 'menu' ? (selectedTable ? `Ordering for ${selectedTable.table_name}` : 'Menu Catalog') : 
                             activeView === 'reports' ? 'Reports & Shift Closing' : 
                             'Customer CRM'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-gray-400 text-sm bg-black/30 px-3 py-1.5 rounded-full">
                            <Clock size={14} />
                            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Staff Member</span>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-pink-500"></div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-hidden">
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
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${
                active 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 scale-110' 
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
        >
            <Icon size={24} strokeWidth={active ? 2.5 : 2} />
            <span className="absolute left-16 bg-[#2A2A2A] text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {label}
            </span>
        </button>
    );
}
