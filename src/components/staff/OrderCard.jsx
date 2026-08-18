import { useState, useEffect } from 'react'
import { Clock, Phone, Printer, Check, X, ChefHat, LogOut, Users, AlertCircle, Receipt, Square, CheckSquare, Timer } from 'lucide-react'
import { formatThaiTimeOnly, formatThaiDateLong } from '../../utils/timeUtils'
import { useOrderContext } from '../../context/OrderContext'
import { getShortBookingId } from '../../utils/printerHelper'

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
    
    // Rams Style Urgency Logic (Pure typography / Minimal accents)
    let colorClass = "text-[oklch(55%_0.010_28)]" // Default neutral
    if (minutes >= 20) {
        colorClass = "text-[oklch(52%_0.16_28)] font-bold animate-pulse" // Red/Terracotta Accent
    } else if (minutes >= 10) {
        colorClass = "text-[oklch(60%_0.15_28)] font-medium" // Focus highlight
    }

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 font-mono text-xs ${colorClass}`}>
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
        <div className="mt-1 text-sm font-semibold text-[oklch(18%_0.012_28)] font-mono space-y-0.5 ml-6">
            {opts.map((o, i) => <div key={i}>— {o}</div>)}
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

export default function OrderCard({ order, onUpdateStatus, onVerifyPayment, onPrint, onHideKds, isSchedule = false, isKDS = false }) {
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
    let urgencyBorder = 'border-[oklch(85%_0.012_28)]' // default rule color
    if (isKDS) {
        const elapsedMins = Math.floor((new Date().getTime() - new Date(order.created_at).getTime()) / 60000)
        if (elapsedMins >= 20) urgencyBorder = 'border-[oklch(52%_0.16_28)] border-2' // Red/Terracotta
        else if (elapsedMins >= 10) urgencyBorder = 'border-[oklch(60%_0.15_28)] border-2' // Highlight
    }

    const renderItemRow = (item, idx, showCheckbox) => {
        const Wrapper = (isKDS && showCheckbox) ? 'button' : 'div'
        return (
            <Wrapper 
                type={(isKDS && showCheckbox) ? "button" : undefined}
                key={idx} 
                className={`w-full text-left flex items-start gap-2 py-2 border-b border-[oklch(85%_0.012_28)] last:border-b-0 ${isKDS && showCheckbox ? 'cursor-pointer select-none group/item touch-manipulation' : ''}`}
                onClick={(e) => {
                    if (showCheckbox) {
                        e.preventDefault();
                        handleToggleCheck(item);
                    }
                }}
            >
                {isKDS && showCheckbox && (
                    <div className="mt-0.5 shrink-0 transition-opacity pointer-events-none">
                        {item.is_checked ? (
                            <CheckSquare size={16} className="text-[oklch(18%_0.012_28)]" />
                        ) : (
                            <Square size={16} className="text-[oklch(55%_0.010_28)] group-hover/item:text-[oklch(18%_0.012_28)]" />
                        )}
                    </div>
                )}
                <div className={`font-mono text-xs mt-0.5 w-6 pointer-events-none ${item.is_checked && showCheckbox ? 'text-[oklch(55%_0.010_28)]' : 'text-[oklch(18%_0.012_28)]'}`}>
                    {item.quantity}
                </div>
                <div className="flex-1 pointer-events-none">
                    <div className={`text-base tracking-tight ${item.is_checked && showCheckbox ? 'text-[oklch(55%_0.010_28)] line-through' : 'text-[oklch(18%_0.012_28)] font-medium'}`}>
                        {item.menu_items?.name}
                    </div>
                    <div className={item.is_checked && showCheckbox ? 'opacity-50' : ''}>
                        {renderOptions(item)}
                    </div>
                </div>
            </Wrapper>
        )
    }

    return (
        <div className={`
            bg-[oklch(97%_0.008_28)] 
            flex flex-col h-full 
            border ${urgencyBorder}
            transition-colors duration-300
        `}>
            {/* Header: Tabular Block */}
            <div className="flex justify-between items-stretch border-b border-[oklch(85%_0.012_28)]">
                <div className="flex flex-col gap-1 p-4 flex-1 border-r border-[oklch(85%_0.012_28)]">
                     <div className="flex items-center gap-3">
                        <span className="text-2xl font-normal tracking-tight text-[oklch(18%_0.012_28)] uppercase leading-none">
                            {order.tables_layout?.table_name || 'Pickup'}
                        </span>
                        
                        {!isPickup && pax > 0 && (
                            <span className="flex items-center gap-1 font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase border border-[oklch(85%_0.012_28)] px-1.5 py-0.5">
                                PAX {pax}
                            </span>
                        )}
                        <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase border border-[oklch(85%_0.012_28)] px-1.5 py-0.5">
                            ID #{getShortBookingId(order)}
                        </span>
                     </div>
                     <div className="font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase mt-1">
                        {customerName}
                     </div>
                </div>
                
                <div className="flex flex-col items-center justify-center px-3 py-1 bg-[oklch(94%_0.010_28)] min-w-[85px] text-right font-mono">
                    {isKDS ? (
                        <OrderTimer createdAt={order.created_at} />
                    ) : (
                        <div className="flex flex-col items-end gap-0.5">
                            <div className="text-[10px] text-[oklch(55%_0.010_28)]">
                                สั่ง: {formatThaiTimeOnly(order.created_at || order.booking_time)}
                            </div>
                            {isPickup ? (
                                <div className="text-xs font-bold text-amber-900 bg-amber-100/90 px-1 py-0.5 rounded border border-amber-300/70">
                                    รับ: {formatThaiTimeOnly(order.booking_time)}
                                </div>
                            ) : (
                                <div className="text-xs font-bold text-[oklch(18%_0.012_28)]">
                                    จอง: {formatThaiTimeOnly(order.booking_time)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Items (Grouped) */}
            <div className="flex-1 p-4">
                {kitchenItems.length > 0 && (
                    <div className="mb-6 last:mb-0">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-[oklch(55%_0.010_28)] mb-2 pb-1 border-b border-[oklch(85%_0.012_28)]">
                            Kitchen Order
                        </div>
                        <div className="flex flex-col">
                            {kitchenItems.map((item, idx) => renderItemRow(item, idx, true))}
                        </div>
                    </div>
                )}
                
                {barItems.length > 0 && (
                    <div className="mb-6 last:mb-0">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-[oklch(55%_0.010_28)] mb-2 pb-1 border-b border-[oklch(85%_0.012_28)]">
                            Bar Order
                        </div>
                        <div className="flex flex-col">
                            {barItems.map((item, idx) => renderItemRow(item, idx, true))}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Customer Note Preview */}
            {order.customer_note && (
                 <div className="px-4 py-3 bg-[oklch(94%_0.010_28)] border-t border-[oklch(85%_0.012_28)] flex gap-2">
                    <AlertCircle size={14} className="text-[oklch(55%_0.010_28)] shrink-0 mt-0.5" />
                    <p className="font-mono text-[10px] text-[oklch(18%_0.012_28)] uppercase leading-relaxed">
                        {order.customer_note}
                    </p>
                 </div>
            )}

            {/* Actions Footer - Rams Tabular Grid */}
            <div className="grid grid-cols-2 border-t border-[oklch(85%_0.012_28)]">
                {/* Left Side Action */}
                <div className="border-r border-[oklch(85%_0.012_28)]">
                    {!isKDS && (
                        order.payment_slip_url ? (
                            <button 
                                onClick={() => onVerifyPayment(order)} 
                                className="w-full h-full flex items-center justify-center gap-2 py-3 font-mono text-[10px] uppercase text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] transition-colors"
                            >
                                <Receipt size={14} /> Verify Slip
                            </button>
                        ) : (
                            <button 
                                onClick={() => onPrint(order)} 
                                className="w-full h-full flex items-center justify-center py-3 font-mono text-[10px] uppercase text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] transition-colors"
                            >
                                <Printer size={14} /> Print
                            </button>
                        )
                    )}
                </div>

                {/* Right Side Action */}
                <div>
                    {order.status === 'pending' && (
                        <div className="grid grid-cols-2 h-full">
                            <button onClick={() => onUpdateStatus(order.id, 'cancelled')} className="flex items-center justify-center font-mono text-[10px] uppercase text-[oklch(55%_0.010_28)] hover:bg-[oklch(94%_0.010_28)] border-r border-[oklch(85%_0.012_28)] transition-colors">Reject</button>
                            <button onClick={() => onUpdateStatus(order.id, 'confirmed')} className="flex items-center justify-center font-mono text-[10px] uppercase bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-black transition-colors">Accept</button>
                        </div>
                    )}
                    
                    {order.status === 'confirmed' && (
                        <button 
                            onClick={() => onUpdateStatus(order.id, order.booking_type === 'pickup' ? 'ready' : 'seated')} 
                            className="w-full h-full flex items-center justify-center py-3 font-mono text-[10px] uppercase text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] transition-colors"
                        >
                             {order.booking_type === 'pickup' ? 'Ready' : 'Check-in'}
                        </button>
                    )}

                    {(order.status === 'ready' || order.status === 'seated') && (
                        isKDS ? (
                            <button 
                                onClick={() => onHideKds && onHideKds(order.id)} 
                                disabled={!allItemsChecked}
                                className={`w-full h-full flex items-center justify-center py-3 font-mono text-[10px] uppercase transition-colors
                                    ${allItemsChecked 
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-black cursor-pointer' 
                                        : 'text-[oklch(55%_0.010_28)] bg-[oklch(94%_0.010_28)] cursor-not-allowed'
                                    }
                                `}
                            >
                                 QC DONE (Hide)
                            </button>
                        ) : (
                            <button 
                                onClick={() => onUpdateStatus(order.id, 'completed')} 
                                disabled={!allItemsChecked}
                                className={`w-full h-full flex items-center justify-center py-3 font-mono text-[10px] uppercase transition-colors
                                    ${allItemsChecked 
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-black cursor-pointer' 
                                        : 'text-[oklch(55%_0.010_28)] bg-[oklch(94%_0.010_28)] cursor-not-allowed'
                                    }
                                `}
                            >
                                 Complete
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}
