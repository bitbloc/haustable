import { useRef, useState, useEffect } from 'react'
import { X, Printer, Download, Check } from 'lucide-react'
import { toPng } from 'html-to-image'
import { supabase } from '../../lib/supabaseClient'


export default function SlipModal({ booking, type, onClose }) {
    const slipRef = useRef(null)
    const [saving, setSaving] = useState(false)
    const [optionMap, setOptionMap] = useState({})

    const isKitchen = type === 'kitchen'
    const title = 'TICKET' // Unified Title

    // Fetch Option Names
    useEffect(() => {
        const fetchOptions = async () => {
            const { data } = await supabase.from('option_choices').select('id, name')
            if (data) {
                const map = data.reduce((acc, opt) => ({ ...acc, [opt.id]: opt.name }), {})
                setOptionMap(map)
            }
        }
        fetchOptions()
    }, [])

    // Generate Nendo-Style HTML for Print
    const getPrintHtml = () => {
        const dateStr = new Date(booking.booking_time).toLocaleString('th-TH')
        const getOptionName = (id) => optionMap[id] || id

        const itemsHtml = booking.order_items?.map(item => {
            const name = item.menu_items?.name || 'Item'
            let optsHtml = ''
            
            if (item.selected_options) {
                let optionsList = []
                if (Array.isArray(item.selected_options)) {
                     optionsList = item.selected_options.map(opt => typeof opt === 'object' ? opt.name : opt)
                } else if (typeof item.selected_options === 'object') {
                    const ids = Object.values(item.selected_options).flat()
                    optionsList = ids.map(id => getOptionName(id))
                }
                if (optionsList.length > 0) {
                    optsHtml = optionsList.map(opt => `<div class="opt">+ ${opt}</div>`).join('')
                }
            }

            // Always show price for "Unified Ticket" request, or hide only if strictly Kitchen? 
            // User asked for "Ticket have price... complete info". So let's show it.
            const price = (item.price_at_time * item.quantity).toLocaleString()

            return `
                <div class="item">
                    <div class="row">
                        <span class="qty">${item.quantity}</span>
                        <span class="name">${name}</span>
                        <span class="price">${price}</span>
                    </div>
                    ${optsHtml ? `<div class="opts">${optsHtml}</div>` : ''}
                </div>
            `
        }).join('') || '<div class="empty">No Items</div>'

        const discountHtml = booking.discount_amount > 0 ? `
            <div class="row meta-row">
                <span>Discount (${booking.promotion_codes?.code || 'PROMO'})</span>
                <span>-${booking.discount_amount.toLocaleString()}</span>
            </div>
        ` : ''

        const noteHtml = booking.customer_note ? `
            <div class="note">
                <div class="note-label">NOTE</div>
                ${booking.customer_note}
            </div>
        ` : ''

        return `
            <html>
                <head>
                    <title>Ticket #${booking.tracking_token || booking.id.slice(0,4)}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                        body { 
                            font-family: 'Courier Prime', 'Courier New', monospace; 
                            background: white; 
                            color: black; 
                            font-size: 12px; 
                            margin: 0; 
                            padding: 20px;
                            width: 300px;
                        }
                        .header { text-align: center; margin-bottom: 20px; text-transform: uppercase; }
                        .brand { font-size: 14px; font-weight: bold; letter-spacing: 2px; margin-bottom: 5px; }
                        .meta { border-top: 1px solid black; border-bottom: 1px solid black; padding: 10px 0; margin-bottom: 20px; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
                        .label { color: #555; }
                        .val { font-weight: bold; }
                        
                        .items { margin-bottom: 20px; }
                        .item { margin-bottom: 12px; }
                        .qty { width: 20px; font-weight: bold; flex-shrink: 0; }
                        .name { flex-grow: 1; margin-right: 10px; font-weight: bold; }
                        .price { text-align: right; width: 60px; flex-shrink: 0; }
                        .opts { margin-left: 20px; margin-top: 2px; color: #444; font-size: 10px; }
                        .opt { margin-bottom: 1px; }

                        .totals { border-top: 1px solid black; padding-top: 10px; margin-bottom: 20px; }
                        .total-row { font-size: 16px; font-weight: bold; margin-top: 5px; }
                        
                        .note { border: 1px solid black; padding: 10px; margin-top: 10px; font-size: 11px; }
                        .note-label { font-weight: bold; margin-bottom: 5px; font-size: 10px; }

                        .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #888; }
                        @media print { body { width: 100%; padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="brand">INTHEHAUS</div>
                        <div>#${booking.tracking_token || booking.id.slice(0, 4)}</div>
                    </div>
                    
                    <div class="meta">
                        <div class="row"><span class="label">TABLE</span> <span class="val">${booking.tables_layout?.table_name || 'PICKUP'}</span></div>
                        <div class="row"><span class="label">DATE</span> <span class="val">${dateStr}</span></div>
                        <div class="row"><span class="label">GUEST</span> <span class="val">${booking.profiles?.display_name || booking.pickup_contact_name || 'Guest'}</span></div>
                        <div class="row"><span class="label">PHONE</span> <span class="val">${booking.profiles?.phone_number || booking.pickup_contact_phone || '-'}</span></div>
                    </div>

                    <div class="items">
                        ${itemsHtml}
                    </div>

                    <div class="totals">
                        <div class="row"><span>Subtotal</span> <span>?</span></div> 
                        <!-- Since subtotal isn't pre-calc in booking usually, we skip or calc it? Booking usually has total_amount. Let's just show Discount and Total for simplicity if subtotal missing -->
                        ${discountHtml}
                        <div class="row total-row">
                            <span>TOTAL</span>
                            <span>${booking.total_amount?.toLocaleString()}</span>
                        </div>
                    </div>

                    ${noteHtml}

                    <div class="footer">
                        THANK YOU
                    </div>

                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `
    }

    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=400,height=600')
        printWindow.document.write(getPrintHtml())
        printWindow.document.close()
    }

    const handleSaveImage = async () => {
        if (!slipRef.current) return
        setSaving(true)
        try {
            const dataUrl = await toPng(slipRef.current, { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: 3 })
            const link = document.createElement('a')
            link.href = dataUrl
            link.download = `ticket-${booking.id.slice(0, 8)}.png`
            link.click()
        } catch (err) {
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    // --- VISUAL RENDER (Matches Print) ---
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#111] rounded-2xl overflow-hidden max-w-md w-full shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-4 flex justify-between items-center text-white border-b border-white/10">
                    <h3 className="font-bold text-sm tracking-widest uppercase">Ticket Preview</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={18} /></button>
                </div>

                {/* Preview Window */}
                <div className="flex-1 overflow-y-auto p-8 bg-[#222] flex justify-center">
                    <div 
                        ref={slipRef} 
                        className="bg-white text-black p-6 w-[320px] shadow-2xl skew-x-0"
                        style={{ fontFamily: "'Courier Prime', 'Courier New', monospace" }}
                    >
                        {/* Ticket Content */}
                        <div className="text-center mb-6">
                            <div className="font-bold text-lg tracking-[0.2em] mb-1">INTHEHAUS</div>
                            <div className="text-xs text-gray-500">#{booking.tracking_token || booking.id.slice(0,4)}</div>
                        </div>

                        <div className="border-y border-black py-3 mb-6 text-xs space-y-1">
                            <div className="flex justify-between items-end"><span className="text-gray-500">TABLE</span> <span className="font-bold text-sm">{booking.tables_layout?.table_name || 'PICKUP'}</span></div>
                            <div className="flex justify-between items-end"><span className="text-gray-500">DATE</span> <span>{new Date(booking.booking_time).toLocaleDateString('th-TH')} {new Date(booking.booking_time).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</span></div>
                            <div className="flex justify-between items-end"><span className="text-gray-500">GUEST</span> <span className="truncate max-w-[150px]">{booking.profiles?.display_name || booking.pickup_contact_name || 'Guest'}</span></div>
                        </div>

                        <div className="space-y-3 mb-6 min-h-[100px]">
                            {booking.order_items?.map((item, idx) => {
                                let optionsList = []
                                if (Array.isArray(item.selected_options)) {
                                     optionsList = item.selected_options.map(opt => typeof opt === 'object' ? opt.name : opt)
                                } else if (typeof item.selected_options === 'object') {
                                    optionsList = Object.values(item.selected_options).flat().map(id => optionMap[id] || id) // Simple map
                                }
                                
                                return (
                                    <div key={idx} className="text-xs">
                                        <div className="flex justify-between font-bold items-start gap-2">
                                            <span className="w-4 shrink-0">{item.quantity}</span>
                                            <span className="grow">{item.menu_items?.name}</span>
                                            <span className="w-16 text-right shrink-0">{(item.price_at_time * item.quantity).toLocaleString()}</span>
                                        </div>
                                        {optionsList.length > 0 && (
                                            <div className="pl-4 mt-1 space-y-0.5 text-[10px] text-gray-500">
                                                {optionsList.map((opt, i) => <div key={i}>+ {opt}</div>)}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <div className="border-t border-black pt-3 mb-4">
                            {booking.discount_amount > 0 && (
                                <div className="flex justify-between text-xs mb-1 text-gray-600">
                                    <span>Discount</span>
                                    <span>-{booking.discount_amount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-lg">
                                <span>TOTAL</span>
                                <span>{booking.total_amount?.toLocaleString()}.-</span>
                            </div>
                        </div>

                        {booking.customer_note && (
                            <div className="border border-black p-2 text-[10px]">
                                <span className="font-bold block mb-1">NOTE</span>
                                {booking.customer_note}
                            </div>
                        )}
                        
                        <div className="text-center mt-8 text-[10px] text-gray-400 spacing-[2px]">
                            THANK YOU
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-[#111] flex gap-3 border-t border-white/10">
                    <button onClick={handlePrint} className="flex-1 bg-white text-black py-3 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                        <Printer size={16} /> Print
                    </button>
                    <button onClick={handleSaveImage} className="flex-1 bg-white/10 text-white py-3 rounded-xl font-bold text-sm hover:bg-white/20 transition-colors flex items-center justify-center gap-2" disabled={saving}>
                        {saving ? 'Saving...' : <><Download size={16} /> Save</>}
                    </button>
                </div>
            </div>
        </div>
    )
}
