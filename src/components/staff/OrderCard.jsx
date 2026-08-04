import { useState, useEffect } from 'react'
import { Clock, Phone, Printer, ImageIcon, Check, X, ChefHat, LogOut, ChevronDown, ChevronUp, Users, AlertCircle, Receipt, Square, CheckSquare, Timer } from 'lucide-react'
import { formatThaiTimeOnly, formatThaiDateLong } from '../../utils/timeUtils'
import { useOrderContext } from '../../context/OrderContext'

const OrderTimer = ({ createdAt }) => {
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        const orderTime = new Date(createdAt).getTime()
        const update = () => {
            const now = new Date().getTime()
            setElapsed(Math.max(0, Math.floor((now - orderTime) / 1000)))
        }
        update()
        const interval = setInterval(update, 10000) // Update every 10s
        return () => clearInterval(interval)
    }, [createdAt])

    const minutes = Math.floor(elapsed / 60)
    
    // Color logic
    let colorClass = "text-gray-500 bg-gray-100" // Default < 10 mins
    let badgeColor = "bg-gray-200"
    if (minutes >= 20) {
        colorClass = "text-red-700 bg-red-100 font-black animate-pulse"
        badgeColor = "bg-red-500"
    } else if (minutes >= 10) {
        colorClass = "text-orange-700 bg-orange-100 font-bold"
        badgeColor = "bg-orange-400"
    }

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${colorClass}`}>
            <Timer size={12} />
            <span>{minutes}m</span>
        </div>
    )
}

const renderOptions = (item) => {
    if (!item.selected_options) return null
    
    let opts = []
    if (Array.isArray(item.selected_options)) {
        opts = item.selected_options.map(o => {
            if (typeof o === 'object' && o !== null) {
                const groupPrefix = o.group_name ? `${o.group_name}: ` : ''
                const priceStr = (o.price && Number(o.price) > 0) ? ` (+฿${o.price})` : ''
                return `${groupPrefix}${o.name}${priceStr}`
            }
            return String(o)
        })
    } else if (typeof item.selected_options === 'object') {
        opts = Object.entries(item.selected_options).flatMap(([key, value]) => {
            if (Array.isArray(value)) {
                return value.map(v => typeof v === 'object' ? `${v.name || v}` : `${key}: ${v}`)
            }
            return [`${key}: ${value}`]
        })
    }
    
    if (opts.length === 0) return null
    return (
        <div className="mt-1 text-xs text-[#ff0000] font-bold space-y-0.5 ml-4">
            {opts.map((o, i) => <div key={i}>▶ {o}</div>)}
        </div>
    )
}

const BAR_CATEGORIES = [
    '7524bb8a-4698-45c6-aa17-d8ccc296f667', // Coffee
    '912683ef-fdc3-40a3-8dd8-b09507791240', // Soft Drink
    'b441665e-2f23-4df3-a11d-63485e1690dc', // Beer
    'a2c783fc-975b-4779-b9eb-67391eeafd1f', // Alcohol
    '1983955d-5787-4351-b729-51b95761f125', // Mocktail & Cocktail
    '1407d869-4eed-489e-aeeb-ba7ef19f57bd', // Bottled
    '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd'  // PRO Beer
];

export default function OrderCard({ order, onUpdateStatus, onVerifyPayment, onPrint, isSchedule = false, isKDS = false }) {
    const { updateOrderItemCheck } = useOrderContext()
    const isPending = order.status === 'pending'
    const isPickup = (order.booking_type === 'pickup') || (!order.tables_layout) // Fallback if type not set
    
    const customerPhone = order.profiles?.phone_number || order.pickup_contact_phone
    const customerName = order.profiles?.display_name || order.pickup_contact_name || 'Guest'
    const pax = order.pax || 0

    const barItems = []
    const kitchenItems = []
    
    order.order_items?.forEach(item => {
        if (BAR_CATEGORIES.includes(item.menu_items?.category_id)) {
            barItems.push(item)
        } else {
            kitchenItems.push(item)
        }
    })

    const allItemsChecked = order.order_items?.length > 0 ? order.order_items.every(item => item.is_checked) : true

    const handleToggleCheck = async (item) => {
        if (!isKDS) return
        const newStatus = !item.is_checked
        await updateOrderItemCheck(item.id, newStatus)
    }

    // Determine urgency level for KDS
    let urgencyBorder = ''
    if (isKDS) {
        const elapsedMins = Math.floor((new Date().getTime() - new Date(order.created_at).getTime()) / 60000)
        if (elapsedMins >= 20) urgencyBorder = 'border-l-4 border-l-red-500'
        else if (elapsedMins >= 10) urgencyBorder = 'border-l-4 border-l-orange-400'
        else urgencyBorder = 'border-l-4 border-l-gray-300'
    }

    const renderItemRow = (item, idx, showCheckbox) => (
        <div 
            key={idx} 
            className={`flex items-start gap-3 ${isKDS && showCheckbox ? 'cursor-pointer active:scale-[0.98] transition-transform select-none' : ''}`}
            onClick={() => showCheckbox && handleToggleCheck(item)}
        >
            {isKDS && showCheckbox && (
                <div className="mt-0.5 shrink-0">
                    {item.is_checked ? (
                        <CheckSquare size={18} className="text-[#1A1A1A] fill-[#DFFF00]" />
                    ) : (
                        <Square size={18} className="text-gray-300" />
                    )}
                </div>
            )}
            <div className={`text-xs font-bold min-w-[1.5rem] ${item.is_checked && showCheckbox ? 'text-gray-400' : 'text-[#1A1A1A]'}`}>
                {item.quantity}x
            </div>
            <div className="flex-1">
                <div className={`text-sm font-medium leading-tight ${item.is_checked && showCheckbox ? 'text-gray-400 line-through' : 'text-[#1A1A1A]'}`}>
                    {item.menu_items?.name}
                </div>
                <div className={item.is_checked && showCheckbox ? 'opacity-50' : ''}>
                    {renderOptions(item)}
                </div>
            </div>
        </div>
    )

    return (
        <div className={`
            bg-white rounded-2xl p-5 transition-all duration-300 relative group overflow-hidden flex flex-col h-full
            ${isPending ? 'shadow-lg shadow-orange-500/10 border border-orange-100' : 'shadow-sm border border-gray-100 hover:border-gray-300'}
            ${urgencyBorder}
        `}>
            {isPending && !isKDS && <div className="absolute top-0 left-0 w-1 h-full bg-[#DFFF00]" />}

            {/* Header: Compact Row */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-[#1A1A1A] leading-none">
                            {order.tables_layout?.table_name || 'Pickup'}
                        </span>
                        
                        {/* Pax: Show only if NOT pickup and > 0 */}
                        {!isPickup && pax > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                <Users size={10} /> {pax}
                            </span>
                        )}
                        <span className="text-[10px] font-mono text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded-full">
                            #{order.tracking_token ? order.tracking_token.slice(-4).toUpperCase() : String(order.id).slice(0,4)}
                        </span>
                     </div>

                     <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                        <span>{customerName}</span>
                         {customerPhone && (
                            <>
                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                <a href={`tel:${customerPhone}`} className="text-blue-600 hover:underline flex items-center gap-1">
                                   <Phone size={10} /> {customerPhone}
                                </a>
                            </>
                        )}
                     </div>
                </div>
                
                <div className="text-right flex flex-col items-end gap-1">
                    {isKDS ? (
                        <OrderTimer createdAt={order.created_at} />
                    ) : (
                        <>
                            <div className="text-sm font-bold text-[#1A1A1A]">
                                {formatThaiTimeOnly(order.booking_time)}
                            </div>
                            <div className="text-[10px] text-gray-400">
                                Ordered {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Items (Grouped) */}
            <div className="space-y-4 mb-4 flex-1">
                {kitchenItems.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-wider text-[#1A1A1A] bg-gray-100 px-2 py-1 rounded w-max">
                            Kitchen / ครัว
                        </div>
                        <div className="space-y-3 pl-1">
                            {kitchenItems.map((item, idx) => renderItemRow(item, idx, true))}
                        </div>
                    </div>
                )}
                
                {kitchenItems.length > 0 && barItems.length > 0 && (
                    <div className="h-px bg-gray-100 w-full my-2" />
                )}

                {barItems.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-wider text-white bg-[#1A1A1A] px-2 py-1 rounded w-max">
                            Bar / บาร์
                        </div>
                        <div className="space-y-3 pl-1">
                            {barItems.map((item, idx) => renderItemRow(item, idx, true))}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Customer Note Preview */}
            {order.customer_note && (
                 <div className="mb-4 bg-orange-50 px-3 py-2 rounded-lg border border-orange-100 flex gap-2">
                    <AlertCircle size={14} className="text-orange-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-900 font-medium line-clamp-2">
                        {order.customer_note}
                    </p>
                 </div>
            )}

            {/* Actions Footer - Clean */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div className="flex gap-2">
                    {/* Verify Payment Button */}
                    {order.payment_slip_url ? (
                        <button 
                            onClick={() => onVerifyPayment(order)} 
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                            <Receipt size={14} /> 
                            Verify Payment
                        </button>
                    ) : (
                         <span className="text-[10px] text-gray-400 font-medium py-2 px-1">No Slip</span>
                    )}
                </div>

                <div className="flex gap-2">
                    <button onClick={() => onPrint(order)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#1A1A1A] transition-colors" title="Print Ticket">
                        <Printer size={16} />
                    </button>

                    {/* Status Actions */}
                    {order.status === 'pending' && (
                        <>
                            <button onClick={() => onUpdateStatus(order.id, 'cancelled')} className="px-3 py-2 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors">Reject</button>
                            <button onClick={() => onUpdateStatus(order.id, 'confirmed')} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#1A1A1A] text-white hover:bg-black transition-transform active:scale-95 shadow-lg shadow-black/10">Accept</button>
                        </>
                    )}
                    
                    {order.status === 'confirmed' && (
                        <button onClick={() => onUpdateStatus(order.id, order.booking_type === 'pickup' ? 'ready' : 'seated')} className="px-4 py-2 rounded-lg text-xs font-bold bg-white border border-gray-200 text-[#1A1A1A] hover:bg-gray-50 transition-colors flex items-center gap-2">
                             {order.booking_type === 'pickup' ? <ChefHat size={14} /> : <Check size={14} />}
                             {order.booking_type === 'pickup' ? 'Ready' : 'Check-in'}
                        </button>
                    )}

                     {(order.status === 'ready' || order.status === 'seated') && (
                        <button 
                            onClick={() => onUpdateStatus(order.id, 'completed')} 
                            disabled={!allItemsChecked}
                            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all
                                ${allItemsChecked 
                                    ? 'bg-[#DFFF00] text-[#1A1A1A] hover:bg-[#ccff00]' 
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                }
                            `}
                        >
                             <LogOut size={14} /> Complete
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
