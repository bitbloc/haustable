// src/AdminDashboard.jsx
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Check, X, Image, Settings, Move, RotateCcw } from 'lucide-react'
import PageTransition from './components/PageTransition'
import { Link } from 'react-router-dom'
import { formatThaiTime, formatThaiTimeOnly, formatThaiDateOnly } from './utils/timeUtils'

export default function AdminDashboard() {
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('dine_in') // 'dine_in' หรือ 'pickup'

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
    }, [])

    const fetchBookings = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
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
                .order('created_at', { ascending: false })

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
                                    {/* Slip Link */}
                                    {booking.payment_slip_url && (
                                        <a href={`https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/slips/${booking.payment_slip_url}`} target="_blank" rel="noreferrer" className="bg-gray-700 p-2 rounded-lg text-white">
                                            <Image size={16} />
                                        </a>
                                    )}

                                    {/* Actions */}
                                    {booking.status === 'pending' && (
                                        <>
                                            <button onClick={() => updateStatus(booking.id, 'confirmed')} className="bg-green-600 text-white p-2 rounded-lg"><Check size={16} /></button>
                                            <button onClick={() => updateStatus(booking.id, 'cancelled')} className="bg-red-600 text-white p-2 rounded-lg"><X size={16} /></button>
                                        </>
                                    )}
                                    {booking.status === 'confirmed' && (
                                        <button onClick={() => updateStatus(booking.id, 'completed')} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Finish</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 2. Desktop Table View (>= md) */}
                <div className="hidden md:block bg-cardDark rounded-3xl shadow overflow-hidden border border-gray-800">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-bgDark/50 text-secondaryText uppercase text-xs">
                                <tr>
                                    <th className="p-4">เวลา</th>
                                    <th className="p-4">{activeTab === 'dine_in' ? 'โต๊ะ' : 'ผู้รับ'}</th>
                                    <th className="p-4">ลูกค้า</th>
                                    <th className="p-4">รายการอาหาร</th>
                                    <th className="p-4">ยอดรวม</th>
                                    <th className="p-4">สลิป</th>
                                    <th className="p-4">สถานะ</th>
                                    <th className="p-4">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {loading ? (
                                    <tr><td colSpan="8" className="p-4 text-center text-secondaryText">Loading...</td></tr>
                                ) : filteredBookings.length === 0 ? (
                                    <tr><td colSpan="8" className="p-10 text-center text-secondaryText">ไม่มีรายการในหมวดหมู่นี้</td></tr>
                                ) : filteredBookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-bgDark/50 transition-colors">
                                        <td className="p-4 text-white">
                                            {booking.booking_type === 'pickup'
                                                ? formatThaiTimeOnly(booking.booking_time)
                                                : formatThaiTime(booking.booking_time)
                                            }
                                        </td>
                                        <td className="p-4 text-white">
                                            {booking.booking_type === 'dine_in'
                                                ? (booking.tables_layout?.table_name || '-')
                                                : (<div>
                                                    <div className="font-bold">{booking.pickup_contact_name}</div>
                                                    <div className="text-xs text-secondaryText">{booking.pickup_contact_phone}</div>
                                                </div>)
                                            }
                                        </td>
                                        <td className="p-4 text-white">
                                            <div className="flex flex-col">
                                                <span>{booking.profiles?.display_name || 'Guest'}</span>
                                                <span className="text-xs text-secondaryText">{booking.profiles?.phone_number}</span>
                                                {booking.customer_note && <div className="mt-1 text-xs text-[#DFFF00] bg-white/5 p-1 rounded border border-white/10 whitespace-pre-wrap">{booking.customer_note}</div>}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <ul className="list-disc list-inside text-sm text-secondaryText">
                                                {booking.order_items.map((item, i) => (
                                                    <li key={i}>
                                                        {item.menu_items?.name} x{item.quantity}
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                        <td className="p-4 font-mono text-primary font-bold">
                                            {booking.total_amount.toLocaleString()}.-
                                        </td>
                                        <td className="p-4">
                                            {booking.payment_slip_url ? (
                                                <a href={`https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/slips/${booking.payment_slip_url}`} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                                    <Image size={16} /> ดูสลิป
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td className="p-4">
                                            {getStatusBadge(booking.status)}
                                        </td>
                                        <td className="p-4">
                                            {booking.status === 'pending' && (
                                                <div className="flex gap-2">
                                                    <button onClick={() => updateStatus(booking.id, 'confirmed')} className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-lg transition-colors" title="Confirm">
                                                        <Check size={16} />
                                                    </button>
                                                    <button onClick={() => updateStatus(booking.id, 'cancelled')} className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-lg transition-colors" title="Cancel">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            )}
                                            {booking.status === 'confirmed' && (
                                                <button onClick={() => updateStatus(booking.id, 'completed')} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-xs" title="Clear Table / Complete">
                                                    <Check size={14} /> Clear / Finish
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </PageTransition>
    )
}
