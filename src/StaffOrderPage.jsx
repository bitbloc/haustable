import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Clock, Check, X, Bell, RefreshCw, ChefHat, User } from 'lucide-react'

// Helper for formatting time
const formatTime = (dateString, timeString) => {
    if (!dateString) return ''
    // Combine if necessary or just use time string if reliable
    // For now, let's trust booking_time for sorting
    const d = new Date(dateString)
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

import { useToast } from './context/ToastContext'
import ConfirmationModal from './components/ConfirmationModal'

// ... existing imports ...

export default function StaffOrderPage() {
    const { toast } = useToast()
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null, isDangerous: false })

    // ... useWakeLock ...
    
    // ... handleLogin ...
             // inside handleLogin error
            } else {
                toast.error('Incorrect PIN')
                setPinInput('')
            }
        } catch (err) {
            toast.error('Error verifying PIN')
        } finally {
            setLoading(false)
        }
    }

    // ... handleLogout ...

    const updateStatus = async (id, newStatus) => {
        setConfirmModal({
            isOpen: true,
            title: newStatus === 'confirmed' ? 'Accept Order?' : 'Reject Order?',
            message: newStatus === 'confirmed' ? 'This order will start cooking.' : 'This order will be cancelled.',
            confirmText: newStatus === 'confirmed' ? 'Accept' : 'Reject',
            isDangerous: newStatus !== 'confirmed',
            action: async () => {
                try {
                    const { error } = await supabase
                        .from('bookings')
                        .update({ status: newStatus })
                        .eq('id', id)
                    
                    if (error) throw error
                    setOrders(prev => prev.filter(o => o.id !== id))
                    toast.success(newStatus === 'confirmed' ? 'Order Accepted!' : 'Order Rejected')
                } catch (err) {
                    toast.error(err.message)
                }
            }
        })
    }

    if (!isAuthenticated) {
        // ... login form ...
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 pb-20 font-sans">
            <ConfirmationModal 
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.action}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDangerous={confirmModal.isDangerous}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-black/90 backdrop-blur py-4 z-10 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div onClick={handleLogout} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition-colors">
                        <ChefHat className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Kitchen View</h1>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                            {isConnected ? 'Live' : 'Offline'}
                        </div>
                    </div>
                </div>
                <button onClick={fetchOrders} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Content */}
            {orders.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 gap-4">
                    <Bell className="w-16 h-16 opacity-20" />
                    <p className="text-lg">No pending orders</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map(order => (
                        <div key={order.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Card Header: Time & Table */}
                            <div className="flex justify-between items-start mb-4 pb-4 border-b border-white/5">
                                <div>
                                    <div className="text-3xl font-bold text-white mb-1">
                                        {order.tables_layout?.table_name || 'Pickup'}
                                    </div>
                                    <div className="flex items-center gap-2 text-orange-400 text-sm font-medium">
                                        <Clock className="w-4 h-4" />
                                        {formatTime(order.booking_date, order.booking_time)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-zinc-500 mb-1">#{order.id.slice(0, 4)}</div>
                                    <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 text-xs font-bold rounded-full border border-yellow-500/20">
                                        PENDING
                                    </span>
                                </div>
                            </div>

                            {/* Order Items */}
                            <div className="space-y-3 mb-6">
                                {order.order_items?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-start text-sm">
                                        <div className="flex gap-3">
                                            <div className="bg-zinc-800 w-6 h-6 flex items-center justify-center rounded text-xs font-bold shrink-0">
                                                {item.quantity}x
                                            </div>
                                            <div>
                                                <div className="text-zinc-200 font-medium">{item.menu_items?.name}</div>
                                                {item.selected_options && (
                                                    <div className="text-zinc-500 text-xs mt-0.5">
                                                        {item.selected_options.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {order.customer_note && (
                                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-red-200 text-xs mt-3 flex gap-2">
                                        <span className="font-bold">Note:</span> {order.customer_note}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => updateStatus(order.id, 'cancelled')}
                                    className="py-4 rounded-xl bg-zinc-800 text-zinc-400 font-bold flex items-center justify-center gap-2 hover:bg-zinc-700 active:scale-95 transition-all"
                                >
                                    <X className="w-5 h-5" />
                                    Reject
                                </button>
                                <button 
                                    onClick={() => updateStatus(order.id, 'confirmed')}
                                    className="py-4 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-green-500 active:scale-95 transition-all"
                                >
                                    <Check className="w-5 h-5" />
                                    Accept Order
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
