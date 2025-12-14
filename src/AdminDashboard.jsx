// src/AdminDashboard.jsx
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Check, X, Image, Settings, Move, RotateCcw } from 'lucide-react'
import PageTransition from './components/PageTransition'
import { Link } from 'react-router-dom'
import { formatThaiTime, formatThaiTimeOnly, formatThaiDateOnly, getThaiDate } from './utils/timeUtils'

export default function AdminDashboard() {
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('dine_in') // 'dine_in' หรือ 'pickup'
    const [filterMode, setFilterMode] = useState('today') // 'today', 'all'

    useEffect(() => {
        fetchBookings()
        // Subscribe to changes (Real-time)
        const subscription = supabase
            .channel('public:bookings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [filterMode])

    const fetchBookings = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('bookings')
                .select(`
                    *,
                    order_items (
                        quantity,
                        price_at_time,
                        menu_items ( name, price )
                    ),
                    profiles ( display_name, phone_number ),
                    tables_layout ( table_name )
                `)

            if (filterMode === 'today') {
                const today = getThaiDate() // YYYY-MM-DD
                query = query.gte('booking_time', `${today}T00:00:00+07:00`)
                    .lte('booking_time', `${today}T23:59:59+07:00`)
                // If today, order by booking time asc (Schedule view)
                query = query.order('booking_time', { ascending: true })
            } else {
                // If all history, order by created_at desc (Latest first)
                query = query.order('created_at', { ascending: false })
            }

            const { data, error } = await query

            if (error) throw error
            setBookings(data || [])
        } catch (error) {
            console.error('Error fetching bookings:', error.message)
            alert('โหลดข้อมูลไม่สำเร็จ: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const updateStatus = async (id, status) => {
        const { error } = await supabase
            .from('bookings')
            .update({ status })
            .eq('id', id)

        if (error) alert('Error updating status')
        else fetchBookings()
    }

    const filteredBookings = bookings.filter(b => b.booking_type === activeTab)

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending': return <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-xs border border-yellow-500/50">รอตรวจสอบ</span>
            case 'confirmed': return <span className="bg-green-500/20 text-green-300 px-2 py-1 rounded-full text-xs border border-green-500/50">อนุมัติแล้ว</span>
            case 'cancelled': return <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded-full text-xs border border-red-500/50">ยกเลิก</span>
            default: return <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded-full text-xs">{status}</span>
        }
    }

    return (
        <PageTransition>
            <div className="p-6 bg-bgDark min-h-screen text-white">
                {/* Header & Refresh */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h1 className="text-2xl font-bold text-primary">จัดการออเดอร์ (Staff Dashboard)</h1>
                    <div className="flex gap-2">
                        {/* Filter Toggle */}
                        <div className="bg-gray-800 p-1 rounded-xl flex">
                            <button
                                onClick={() => setFilterMode('today')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterMode === 'today' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}
                            >
                                วันนี้
                            </button>
                            <button
                                onClick={() => setFilterMode('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterMode === 'all' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}
                            >
                                ทั้งหมด
                            </button>
                        </div>
                        <button onClick={fetchBookings} className="px-4 py-2 bg-primary text-bgDark font-bold rounded-xl shadow-sm hover:bg-primary/80 transition-colors flex items-center gap-2">
                            <RotateCcw className="w-4 h-4" /> Refresh
                        </button>
                    </div>
                </div>

                {/* --- TABS SWITCHER (ใหม่) --- */}
                <div className="flex p-1 bg-cardDark rounded-2xl mb-6 w-fit border border-gray-800">
                    <button
                        onClick={() => setActiveTab('dine_in')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'dine_in' ? 'bg-primary text-bgDark shadow-lg' : 'text-secondaryText hover:text-white'}`}
                    >
                        🍽️ จองโต๊ะ (Dine-in)
                    </button>
                    <button
                        onClick={() => setActiveTab('pickup')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'pickup' ? 'bg-primary text-bgDark shadow-lg' : 'text-secondaryText hover:text-white'}`}
                    >
                        🛍️ สั่งกลับบ้าน (Pickup)
                    </button>
                </div>

                {/* --- Display Switch: Mobile Cards vs Desktop Table --- */}

                {/* 1. Mobile Card View (< md) */}
                <div className="md:hidden space-y-4">
                    {loading ? (
                        <div className="text-center text-secondaryText py-10">Loading...</div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="text-center text-secondaryText py-10 bg-cardDark rounded-2xl border border-gray-800">ไม่มีรายการในหมวดหมู่นี้</div>
                    ) : filteredBookings.map((booking) => (
                        <div key={booking.id} className="bg-cardDark p-5 rounded-2xl border border-gray-800 shadow-sm flex flex-col gap-3">
                            {/* Header: Time & Status */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-lg font-bold text-white">
                                        {formatThaiTimeOnly(booking.booking_time)}
                                    </div>
                                    <div className="text-xs text-secondaryText">
                                        {formatThaiDateOnly(booking.booking_time)}
                                        {booking.booking_type === 'dine_in' && ` • โต๊ะ ${booking.tables_layout?.table_name || '-'}`}
                                    </div>
                                </div>
                                {getStatusBadge(booking.status)}
                            </div>

                            {/* Customer Info */}
                            <div className="bg-bgDark/50 p-3 rounded-xl border border-white/5">
                                <div className="font-bold text-white">
                                    {booking.booking_type === 'pickup' ? booking.pickup_contact_name : (booking.profiles?.display_name || 'Guest')}
                                </div>
                                <div className="text-xs text-secondaryText">
                                    {booking.booking_type === 'pickup' ? booking.pickup_contact_phone : booking.profiles?.phone_number}
                                </div>
                                {booking.customer_note && <div className="mt-2 text-xs text-[#DFFF00] border-t border-white/10 pt-1">{booking.customer_note}</div>}
                            </div>

                            {/* Order Items */}
                            <div className="text-sm text-secondaryText pl-2 border-l-2 border-gray-700">
                                {booking.order_items.map((item, i) => (
                                    <div key={i} className="flex justify-between">
                                        <span>{item.menu_items?.name} x{item.quantity}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Footer: Total & Actions */}
                            <div className="flex justify-between items-center pt-2 border-t border-gray-800 mt-1">
                                <div className="font-mono font-bold text-xl text-primary">{booking.total_amount.toLocaleString()}.-</div>
                                <div className="flex gap-2">
                                    {booking.payment_slip_url && (
                                        <a href={booking.payment_slip_url} target="_blank" rel="noreferrer" className="p-2 bg-gray-700 rounded-lg text-white hover:bg-gray-600">
                                            <Image size={18} />
                                        </a>
                                    )}
                                    {booking.status === 'pending' && (
                                        <>
                                            <button onClick={() => updateStatus(booking.id, 'confirmed')} className="p-2 bg-green-500/20 text-green-400 rounded-lg border border-green-500/50 hover:bg-green-500/30">
                                                <Check size={18} />
                                            </button>
                                            <button onClick={() => updateStatus(booking.id, 'cancelled')} className="p-2 bg-red-500/20 text-red-400 rounded-lg border border-red-500/50 hover:bg-red-500/30">
                                                <X size={18} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 2. Desktop Table View (>= md) */}
                <div className="hidden md:block overflow-x-auto rounded-3xl border border-gray-800 shadow-xl">
                    <table className="w-full bg-cardDark text-left border-collapse">
                        <thead className="bg-[#1A1A1A] text-secondaryText uppercase text-xs tracking-wider">
                            <tr>
                                <th className="p-4 border-b border-gray-800">Time</th>
                                <th className="p-4 border-b border-gray-800">Date</th>
                                <th className="p-4 border-b border-gray-800">Table</th>
                                <th className="p-4 border-b border-gray-800">Customer</th>
                                <th className="p-4 border-b border-gray-800">Details</th>
                                <th className="p-4 border-b border-gray-800 text-right">Total</th>
                                <th className="p-4 border-b border-gray-800">Slip</th>
                                <th className="p-4 border-b border-gray-800">Status</th>
                                <th className="p-4 border-b border-gray-800">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {loading ? (
                                <tr><td colSpan="9" className="p-8 text-center text-gray-500">Loading bookings...</td></tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr><td colSpan="9" className="p-8 text-center text-gray-500">No bookings found in this category.</td></tr>
                            ) : filteredBookings.map((booking) => (
                                <tr key={booking.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4 font-bold text-white border-r border-gray-800/50">
                                        {formatThaiTimeOnly(booking.booking_time)}
                                    </td>
                                    <td className="p-4 text-sm text-secondaryText">
                                        {formatThaiDateOnly(booking.booking_time)}
                                    </td>
                                    <td className="p-4">
                                        {booking.booking_type === 'dine_in' ? (
                                            <span className="bg-gray-800 text-white px-2 py-1 rounded text-xs font-bold">
                                                {booking.tables_layout?.table_name}
                                            </span>
                                        ) : (
                                            <span className="text-secondaryText text-xs">Pickup</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-white text-sm">
                                            {booking.booking_type === 'pickup' ? booking.pickup_contact_name : (booking.profiles?.display_name || 'Guest')}
                                        </div>
                                        <div className="text-xs text-secondaryText">
                                            {booking.booking_type === 'pickup' ? booking.pickup_contact_phone : booking.profiles?.phone_number}
                                        </div>
                                        {booking.customer_note && <div className="text-xs text-[#DFFF00] mt-1">{booking.customer_note}</div>}
                                    </td>
                                    <td className="p-4 max-w-xs">
                                        <div className="flex flex-col gap-1">
                                            {booking.order_items.map((item, i) => (
                                                <div key={i} className="flex justify-between text-xs text-gray-400">
                                                    <span>{item.menu_items?.name}</span>
                                                    <span className="text-gray-500">x{item.quantity}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-primary">
                                        {booking.total_amount.toLocaleString()}
                                    </td>
                                    <td className="p-4">
                                        {booking.payment_slip_url ? (
                                            <a href={booking.payment_slip_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-xs">
                                                <Image size={14} /> View
                                            </a>
                                        ) : (
                                            <span className="text-gray-600 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {getStatusBadge(booking.status)}
                                    </td>
                                    <td className="p-4">
                                        {booking.status === 'pending' && (
                                            <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => updateStatus(booking.id, 'confirmed')} className="p-1.5 bg-green-500 rounded text-black hover:bg-green-400 shadow-lg hover:scale-105 transition-transform" title="Approve">
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={() => updateStatus(booking.id, 'cancelled')} className="p-1.5 bg-red-500 rounded text-white hover:bg-red-400 shadow-lg hover:scale-105 transition-transform" title="Reject">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </PageTransition>
    )
}
