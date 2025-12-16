// src/AdminDashboard.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/supabaseClient'
import { RotateCcw } from 'lucide-react'
import PageTransition from './components/PageTransition'
import { getThaiDate } from './utils/timeUtils'

// Components
import InboxSection from './components/admin/InboxSection'
import ScheduleSection from './components/admin/ScheduleSection'

import { useToast } from './context/ToastContext'
import ConfirmationModal from './components/ConfirmationModal'

export default function AdminDashboard() {
    const { toast } = useToast()
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null })
    
    // ... fetchData ...

    const updateStatus = async (id, status) => {
        // We will use the modal for this action
        setConfirmModal({
            isOpen: true,
            title: status === 'confirmed' ? 'Confirm Order' : (status === 'cancelled' ? 'Reject Order' : 'Update Status'),
            message: `Are you sure you want to mark this order as ${status}?`,
            isDangerous: status === 'cancelled',
            action: async () => {
                // Optimistic Update can happen here or after success
                // Let's do after success for safety or keep optimistic if preferred
                // Keeping previous logic:
                setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))

                const { error } = await supabase
                    .from('bookings')
                    .update({ status })
                    .eq('id', id)

                if (error) {
                    toast.error('Error updating status')
                    fetchData()
                } else {
                    toast.success('Status updated')
                    fetchData()
                }
            }
        })
    }

    // ... derived state ...

    return (
        <PageTransition>
            <ConfirmationModal 
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.action}
                title={confirmModal.title}
                message={confirmModal.message}
                isDangerous={confirmModal.isDangerous}
            />
            
            <div className="p-6 bg-bgDark min-h-screen text-white pb-20">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
                        <p className="text-xs text-gray-400">Manage orders and reservations</p>
                    </div>
                    <button onClick={fetchData} className="px-4 py-2 bg-primary text-bgDark font-bold rounded-xl hover:bg-primary/80 transition-colors flex items-center gap-2">
                        <RotateCcw className="w-4 h-4" /> Refresh
                    </button>
                </div>

                {/* --- TABS --- */}
                <div className="flex p-1 bg-cardDark rounded-2xl mb-8 w-fit border border-gray-800">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'overview' ? 'bg-primary text-bgDark shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('dine_in')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'dine_in' ? 'bg-primary text-bgDark shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Dine-in Only
                    </button>
                    <button
                        onClick={() => setActiveTab('pickup')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'pickup' ? 'bg-primary text-bgDark shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Pickup Only
                    </button>
                </div>

                {/* CONTENT */}
                <div className="max-w-7xl mx-auto">
                    {getTabContent()}
                </div>
            </div>
        </PageTransition>
    )
}
