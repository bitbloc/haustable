import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, CheckCircle, AlertCircle, ChefHat, Utensils, ArrowRight, ExternalLink, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'

export default function HistoryModal({ isOpen, onClose, history }) {
    const { t } = useLanguage()
    const { activeOrders, pastOrders, loading } = history

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Clock size={20} className="text-black" />
                            {t('myOrders') || "My Orders"}
                        </h2>
                        <button 
                            onClick={onClose}
                            className="p-2 -mr-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content Scrollable */}
                    <div className="overflow-y-auto p-4 space-y-6 flex-1 bg-gray-50">
                        
                        {loading ? (
                             <div className="flex justify-center py-10">
                                <div className="animate-spin w-8 h-8 border-2 border-gray-200 border-t-black rounded-full"></div>
                             </div>
                        ) : (activeOrders.length === 0 && pastOrders.length === 0) ? (
                            <div className="text-center py-10 opacity-50">
                                <Utensils className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-sm text-gray-500">No orders yet</p>
                            </div>
                        ) : (
                            <>
                                {/* Active Orders Section */}
                                {activeOrders.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-2">
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Orders</h3>
                                        </div>
                                        
                                        {activeOrders.map(order => (
                                            <Link 
                                                key={order.id}
                                                to={`/tracking/${order.tracking_token}`}
                                                onClick={onClose}
                                                className="block"
                                            >
                                                <motion.div 
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    className="bg-white p-5 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-green-100 relative overflow-hidden group"
                                                >
                                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                        <ExternalLink size={40} />
                                                    </div>

                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-2xl font-black font-mono tracking-tight">
                                                                    #{getShortId(order.tracking_token)}
                                                                </span>
                                                                <StatusBadge status={order.status} />
                                                            </div>
                                                            <p className="text-xs text-gray-400 font-medium">
                                                                {new Date(order.booking_time).toLocaleDateString('th-TH', { 
                                                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                                                        <div className="flex items-center gap-2 text-sm font-bold text-black">
                                                            {bookingTypeLabel(order)}
                                                        </div>
                                                        <div className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 group-hover:bg-gray-800 transition-colors">
                                                            Track Status <ArrowRight size={14} />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                {/* Separator if needed */}
                                {activeOrders.length > 0 && pastOrders.length > 0 && (
                                    <div className="border-t border-gray-200 my-2" />
                                )}

                                {/* Past Orders Section */}
                                {pastOrders.length > 0 && (
                                    <div className="space-y-3">
                                        <h3 className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Past Orders</h3>
                                        
                                        {pastOrders.map(order => (
                                            <div 
                                                key={order.id}
                                                className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                                        order.status === 'cancelled' || order.status === 'void' ? 'bg-red-50 text-red-400' : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                        {order.status === 'cancelled' || order.status === 'void' ? <X size={18}/> : <CheckCircle size={18}/>}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono font-bold text-gray-900">
                                                                #{getShortId(order.tracking_token)}
                                                            </span>
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase font-bold">
                                                                {order.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            {new Date(order.booking_time).toLocaleDateString('th-TH')}
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <Link 
                                                    to={`/tracking/${order.tracking_token}`}
                                                    onClick={onClose}
                                                    className="p-2 text-gray-300 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                                >
                                                    <ArrowRight size={16} />
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

function StatusBadge({ status }) {
    const s = status?.toLowerCase()
    let color = "bg-gray-100 text-gray-600"
    
    if (['confirmed', 'paid'].includes(s)) color = "bg-blue-100 text-blue-700"
    if (['preparing', 'kitchen'].includes(s)) color = "bg-orange-100 text-orange-700"
    if (['ready', 'served'].includes(s)) color = "bg-green-100 text-green-700"
    
    return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${color}`}>
            {status}
        </span>
    )
}

function getShortId(token) {
    return token ? token.slice(-4).toUpperCase() : '----'
}

function bookingTypeLabel(order) {
    if (order.booking_type === 'steak') return 'Steak Pre-order'
    if (order.booking_type === 'pickup') return 'Pickup'
    if (order.table_name) return `Table ${order.table_name}`
    return 'Dine-in'
}
