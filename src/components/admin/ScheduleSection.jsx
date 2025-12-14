import { formatThaiTimeOnly } from '../../utils/timeUtils'
import { MoreHorizontal, Printer, CheckCircle, ChefHat } from 'lucide-react'

export default function ScheduleSection({ bookings, loading }) {
    if (loading) return <div className="text-center py-10 text-gray-500 animate-pulse">Loading schedule...</div>

    return (
        <div className="bg-[#111] rounded-3xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#161616]">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Today's Schedule
                    </h2>
                    <p className="text-xs text-gray-500">Confirmed orders for today</p>
                </div>
                <div className="text-xs font-mono text-gray-500 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                    {bookings.length} Orders
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-black/40 text-xs uppercase text-gray-500 font-bold tracking-wider">
                        <tr>
                            <th className="p-4 pl-6">Time</th>
                            <th className="p-4">Table / Set</th>
                            <th className="p-4">Customer</th>
                            <th className="p-4">Items</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 pr-6 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {bookings.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="p-12 text-center">
                                    <div className="flex flex-col items-center gap-3 text-gray-600">
                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                            <CheckCircle size={24} />
                                        </div>
                                        <p>All caught up! No confirmed orders for today.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            bookings.map(booking => (
                                <tr key={booking.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-4 pl-6 font-mono font-bold text-white">
                                        {formatThaiTimeOnly(booking.booking_time)}
                                    </td>
                                    <td className="p-4">
                                        {booking.booking_type === 'dine_in' ? (
                                            <span className="bg-gray-800 text-white px-2.5 py-1 rounded-lg text-xs font-bold border border-white/10">
                                                {booking.tables_layout?.table_name || 'Table ?'}
                                            </span>
                                        ) : (
                                            <span className="bg-blue-900/30 text-blue-300 px-2.5 py-1 rounded-lg text-xs font-bold border border-blue-500/20">
                                                Pickup
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-sm text-gray-200">
                                            {booking.booking_type === 'pickup' ? booking.pickup_contact_name : (booking.profiles?.display_name || 'Guest')}
                                        </div>
                                        {booking.customer_note && (
                                            <span className="text-[10px] text-yellow-500/80 block max-w-[150px] truncate">
                                                Note: {booking.customer_note}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            {booking.order_items.map((item, i) => (
                                                <div key={i} className="text-xs text-gray-400 flex justify-between w-32">
                                                    <span className="truncate">{item.menu_items?.name}</span>
                                                    <span className="text-gray-600">x{item.quantity}</span>
                                                </div>
                                            ))}
                                            {booking.order_items.length > 2 && (
                                                <span className="text-[10px] text-gray-600">+more...</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                            Confirmed
                                        </span>
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="Print Kitchen Slip">
                                                <ChefHat size={16} />
                                            </button>
                                            <button className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="View Details">
                                                <MoreHorizontal size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
