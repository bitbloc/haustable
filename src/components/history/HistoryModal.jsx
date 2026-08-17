/* Hallmark · component: HistoryModal · genre: modern-minimal · theme: dieter-rams-thai-modern
 * states: default · loading · empty · active-orders · past-orders
 * contrast: pass (APCA / WCAG AAA compliant)
 */
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { getShortBookingId } from '../../utils/printerHelper'

export default function HistoryModal({ isOpen, onClose, history }) {
    const { activeOrders = [], pastOrders = [], loading } = history || {}

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 select-none">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-xs"
                />

                {/* Modal Container (Brutalist Tabular Panel) */}
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 26, stiffness: 220 }}
                    className="relative w-full max-w-lg bg-[var(--color-hallmark-paper)] border-t sm:border border-[var(--color-hallmark-rule)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col font-[var(--font-body)] text-[var(--color-hallmark-ink)]"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-black uppercase tracking-wider text-[var(--color-hallmark-ink)]">
                                [ TICKETS // ORDER HISTORY ]
                            </span>
                        </div>
                        <button 
                            onClick={onClose}
                            className="font-mono text-[11px] font-bold px-2 py-1 border border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-ink)] hover:text-[var(--color-hallmark-paper)] transition-colors cursor-pointer"
                        >
                            [ ✕ CLOSE ]
                        </button>
                    </div>

                    {/* Content Scrollable Area */}
                    <div className="overflow-y-auto p-4 space-y-5 flex-1 bg-[var(--color-hallmark-paper)]">
                        
                        {loading ? (
                             <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--color-hallmark-ink-muted)] font-mono text-[11px]">
                                <div className="w-6 h-6 border-2 border-[var(--color-hallmark-ink)] border-t-transparent rounded-full animate-spin" />
                                <span>LOADING TICKETS...</span>
                             </div>
                        ) : (activeOrders.length === 0 && pastOrders.length === 0) ? (
                            <div className="text-center py-12 border border-dashed border-[var(--color-hallmark-rule)] p-6 bg-[var(--color-hallmark-paper-dark)]">
                                <span className="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink-muted)] uppercase block">
                                    [ NO ORDER TICKETS FOUND ]
                                </span>
                                <p className="text-[12px] text-[var(--color-hallmark-ink-muted)] mt-1">
                                    ยังไม่มีประวัติการจองโต๊ะหรือสั่งอาหาร
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* 1. Active Orders Section */}
                                {activeOrders.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between pb-1 border-b border-[var(--color-hallmark-rule)]">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                                <h3 className="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink)] uppercase tracking-wider">
                                                    ACTIVE ORDERS ({activeOrders.length})
                                                </h3>
                                            </div>
                                            <span className="font-mono text-[10px] text-[var(--color-brand)] font-bold">
                                                LIVE TRACKING
                                            </span>
                                        </div>
                                        
                                        {activeOrders.map(order => (
                                            <Link 
                                                key={order.id}
                                                to={`/tracking/${order.tracking_token}`}
                                                onClick={onClose}
                                                className="block group"
                                            >
                                                <div className="bg-[var(--color-hallmark-paper-dark)] p-4 border border-[var(--color-hallmark-rule)] hover:border-[var(--color-hallmark-ink)] transition-colors">
                                                    {/* Ticket Top Row */}
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg font-black font-mono tracking-tight text-[var(--color-hallmark-ink)]">
                                                                    #{getShortBookingId(order)}
                                                                </span>
                                                                <StatusBadge status={order.status} />
                                                            </div>
                                                            <p className="font-mono text-[11px] text-[var(--color-hallmark-ink-muted)] mt-0.5">
                                                                {order.booking_time ? new Date(order.booking_time).toLocaleDateString('th-TH', { 
                                                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                                }) : '-'}
                                                            </p>
                                                        </div>
                                                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] text-[var(--color-hallmark-ink)]">
                                                            {bookingTypeLabel(order)}
                                                        </span>
                                                    </div>

                                                    {/* Order Items Breakdown */}
                                                    {order.order_items && order.order_items.length > 0 && (
                                                        <div className="my-2 p-2.5 bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] font-mono text-[11px] space-y-1 text-[var(--color-hallmark-ink)]">
                                                            {order.order_items.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between">
                                                                    <span className="truncate pr-2">{item.menu_items?.name || item.name || 'Item'}</span>
                                                                    <span className="font-bold flex-shrink-0">x{item.quantity}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Points summary */}
                                                    {(Number(order.xhaus_earned || 0) > 0 || Number(order.xhaus_redeemed || 0) > 0) && (
                                                        <div className="flex gap-2 font-mono text-[10px] font-bold mt-1.5">
                                                            {Number(order.xhaus_earned || 0) > 0 && (
                                                                <span className="text-emerald-700 bg-emerald-100/50 px-1.5 py-0.5 border border-emerald-300">
                                                                    +{Number(order.xhaus_earned)} xhaus
                                                                </span>
                                                            )}
                                                            {Number(order.xhaus_redeemed || 0) > 0 && (
                                                                <span className="text-rose-700 bg-rose-100/50 px-1.5 py-0.5 border border-rose-300">
                                                                    -{Number(order.xhaus_redeemed)} xhaus
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Footer Action */}
                                                    <div className="mt-3 pt-2.5 border-t border-[var(--color-hallmark-rule)] flex items-center justify-between">
                                                        <span className="font-mono text-[12px] font-bold text-[var(--color-hallmark-ink)]">
                                                            {Number(order.total_amount || 0) > 0 ? `฿${Number(order.total_amount).toLocaleString()}` : ''}
                                                        </span>
                                                        <span className="font-mono text-[11px] font-black text-[var(--color-hallmark-ink)] group-hover:underline flex items-center gap-1">
                                                            <span>TRACK LIVE STATUS</span> <span>➔</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                {/* 2. Past Orders Section */}
                                {pastOrders.length > 0 && (
                                    <div className="space-y-3 pt-2">
                                        <div className="pb-1 border-b border-[var(--color-hallmark-rule)]">
                                            <h3 className="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink-muted)] uppercase tracking-wider">
                                                PAST ORDERS ({pastOrders.length})
                                            </h3>
                                        </div>
                                        
                                        {pastOrders.map(order => (
                                            <div 
                                                key={order.id}
                                                className="bg-[var(--color-hallmark-paper-dark)] p-3.5 border border-[var(--color-hallmark-rule)] flex flex-col gap-2 opacity-85 hover:opacity-100 transition-opacity"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-[var(--color-hallmark-ink)] text-sm">
                                                            #{getShortBookingId(order)}
                                                        </span>
                                                        <StatusBadge status={order.status} />
                                                    </div>
                                                    
                                                    {order.tracking_token && (
                                                        <Link 
                                                            to={`/tracking/${order.tracking_token}`}
                                                            onClick={onClose}
                                                            className="font-mono text-[10px] font-bold text-[var(--color-hallmark-ink-muted)] hover:text-[var(--color-hallmark-ink)] underline"
                                                        >
                                                            [ RECEIPT ➔ ]
                                                        </Link>
                                                    )}
                                                </div>

                                                <p className="font-mono text-[11px] text-[var(--color-hallmark-ink-muted)]">
                                                    {order.booking_time ? new Date(order.booking_time).toLocaleDateString('th-TH') : '-'} · {bookingTypeLabel(order)}
                                                </p>

                                                {/* Past Order items list */}
                                                {order.order_items && order.order_items.length > 0 && (
                                                    <div className="p-2 bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] text-[11px] font-mono text-[var(--color-hallmark-ink)] space-y-0.5">
                                                        {order.order_items.map((item, idx) => (
                                                            <div key={idx} className="flex justify-between">
                                                                <span className="truncate pr-2">{item.menu_items?.name || item.name || 'Item'}</span>
                                                                <span className="font-bold">x{item.quantity}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Points & Total summary */}
                                                <div className="flex justify-between items-center text-[11px] font-mono pt-1 border-t border-[var(--color-hallmark-rule)]">
                                                    <div className="flex gap-1.5 font-bold">
                                                        {Number(order.xhaus_earned || 0) > 0 && (
                                                            <span className="text-emerald-700 bg-emerald-100/50 px-1 py-0.2 border border-emerald-300 text-[9px]">
                                                                +{Number(order.xhaus_earned)} xhaus
                                                            </span>
                                                        )}
                                                    </div>
                                                    {Number(order.total_amount || 0) > 0 && (
                                                        <span className="font-bold text-[var(--color-hallmark-ink)]">
                                                            ฿{Number(order.total_amount).toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
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
    
    if (['confirmed', 'paid', 'approved'].includes(s)) {
        return (
            <span className="px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300">
                [ {status} ]
            </span>
        )
    }
    if (['preparing', 'kitchen'].includes(s)) {
        return (
            <span className="px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 animate-pulse">
                [ {status} ]
            </span>
        )
    }
    if (['ready', 'served', 'completed'].includes(s)) {
        return (
            <span className="px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300">
                [ {status} ]
            </span>
        )
    }
    if (['cancelled', 'void', 'rejected'].includes(s)) {
        return (
            <span className="px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-300">
                [ {status} ]
            </span>
        )
    }
    
    return (
        <span className="px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink-muted)] border border-[var(--color-hallmark-rule)]">
            [ {status || 'PENDING'} ]
        </span>
    )
}

function bookingTypeLabel(order) {
    if (order.booking_type === 'pickup') return 'PICKUP'
    if (order.table_name) return `TABLE ${order.table_name}`
    return 'DINE-IN'
}

