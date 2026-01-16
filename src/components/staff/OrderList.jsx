import OrderCard from './OrderCard'
import { Bell } from 'lucide-react'

export default function OrderList({ orders, loading, emptyMessage = "No Active Orders", onUpdateStatus, onViewSlip, onPrint }) {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 opacity-50 space-y-4">
                 <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-[#1A1A1A] rounded-full"></div>
                 <p className="text-xs text-gray-400 font-bold">Syncing...</p>
            </div>
        )
    }

    if (!orders || orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400 gap-4">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
                    <Bell className="w-10 h-10 opacity-40" />
                </div>
                <p className="text-lg font-medium text-gray-500">{emptyMessage}</p>
                <p className="text-xs">Waiting for updates...</p>
            </div>
        )
    }

    return (
        <div className="space-y-4 pb-20">
            {orders.map(order => (
                <OrderCard 
                    key={order.id} 
                    order={order} 
                    onUpdateStatus={onUpdateStatus}
                    onViewSlip={onViewSlip}
                    onPrint={onPrint}
                />
            ))}
        </div>
    )
}
