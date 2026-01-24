import { formatThaiTimeOnly } from '../../utils/timeUtils'
import { MoreHorizontal, Printer, CheckCircle, ChefHat } from 'lucide-react'

export default function ScheduleSection({ bookings, loading }) {
    if (loading) return <div className="text-center py-10 text-subInk animate-pulse">Loading schedule...</div>

    return (
        <div className="bg-paper rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                <div>
                    <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand border border-black/10"></span>
                        Today's Schedule
                    </h2>
                    <p className="text-xs text-subInk mt-0.5">Confirmed orders for today</p>
                </div>
                <div className="text-xs font-mono font-bold text-ink bg-brand px-3 py-1 rounded-full border border-brandDark/20">
                    {bookings.length} Orders
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-canvas text-[11px] uppercase text-subInk font-bold tracking-wider border-b border-gray-100">
                        <tr>
                            <th className="p-4 pl-6">Time</th>
                            <th className="p-4">Table / Set</th>
                            <th className="p-4">Customer</th>
                            <th className="p-4">Items</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 pr-6 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {bookings.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="p-16 text-center">
                                    <div className="flex flex-col items-center gap-3 text-subInk opacity-60">
                                        <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center border border-gray-100">
                                            <CheckCircle size={24} className="text-gray-400" />
                                        </div>
                                        <p className="font-medium">All caught up! No confirmed orders for today.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            bookings.map(booking => (
                                <tr key={booking.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="p-4 pl-6 font-mono font-bold text-ink">
                                        {formatThaiTimeOnly(booking.booking_time)}
                                    </td>
                                    <td className="p-4">
                                        {booking.booking_type === 'dine_in' ? (
                                            <span className="bg-gray-100 text-ink px-3 py-1 rounded-md text-xs font-bold border border-gray-200">
                                                {booking.tables_layout?.table_name || 'Table ?'}
                                            </span>
                                        ) : (
                                            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-md text-xs font-bold border border-blue-100">
                                                Pickup
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-sm text-ink">
                                            {booking.booking_type === 'pickup' ? booking.pickup_contact_name : (booking.profiles?.display_name || 'Guest')}
                                        </div>
                                        {booking.customer_note && (
                                            <span className="text-[10px] bg-yellow-50 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-100 inline-block mt-1 max-w-[150px] truncate">
                                                Note: {booking.customer_note}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            {booking.order_items.map((item, i) => (
                                                <div key={i} className="text-xs text-subInk flex justify-between w-36">
                                                    <span className="truncate font-medium text-ink max-w-[100px]">{item.menu_items?.name}</span>
                                                    <span className="text-subInk">x{item.quantity}</span>
                                                </div>
                                            ))}
                                            {booking.order_items.length > 2 && (
                                                <span className="text-[10px] text-gray-400 font-medium">+ {booking.order_items.length - 2} more...</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-600 border border-green-100">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                            Confirmed
                                        </span>
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <div className="flex justify-end gap-2 opacity-50 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 bg-white border border-gray-200 rounded-lg text-subInk hover:text-ink hover:border-gray-300 transition-colors shadow-sm" title="Print Kitchen Slip">
                                                <ChefHat size={16} />
                                            </button>
                                            <button className="p-2 bg-white border border-gray-200 rounded-lg text-subInk hover:text-ink hover:border-gray-300 transition-colors shadow-sm" title="View Details">
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
