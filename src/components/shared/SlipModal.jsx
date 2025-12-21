import { useRef, useState, useEffect } from 'react'
import { X, Printer, Download, Check } from 'lucide-react'
import { toPng } from 'html-to-image'
import { supabase } from '../../lib/supabaseClient'

export default function SlipModal({ booking, type, onClose }) {
    const slipRef = useRef(null)
    const [saving, setSaving] = useState(false)
    const [optionMap, setOptionMap] = useState({})

    const isKitchen = type === 'kitchen'
    const title = isKitchen ? 'KITCHEN SLIP' : 'RECEIPT'

    // Fetch Option Names for readable display
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

    // Save as Image using html-to-image
    const handleSaveImage = async () => {
        if (!slipRef.current) return
        setSaving(true)
        try {
            // Force white bg and ensure fonts are loaded
            const dataUrl = await toPng(slipRef.current, {
                cacheBust: true,
                backgroundColor: '#ffffff',
                pixelRatio: 2 // Better quality 
            })

            // Trigger Download
            const link = document.createElement('a')
            link.href = dataUrl
            link.download = `slip-${type}-${booking.id.slice(0, 8)}.png`
            link.click()
        } catch (err) {
            console.error("Generate Error:", err)
            alert('Failed to generate image: ' + (err.message || 'Unknown Error'))
        } finally {
            setSaving(false)
        }
    }

    // Print Handling (Native Window for Thermal Printers)
    const handlePrint = () => {
        const dateStr = new Date(booking.booking_time).toLocaleString('th-TH')
        const tableName = booking.tables_layout?.table_name || 'N/A'

        // Translate Options Helper
        const getOptionName = (id) => optionMap[id] || id

        // Generate Items HTML
        const itemsHtml = booking.order_items?.map(item => {
            const name = item.menu_items?.name || 'Unknown Item'

            // Map IDs to Names
            let opts = ''
            if (item.selected_options) {
                const ids = Object.values(item.selected_options).flat()
                if (ids.length > 0) {
                    opts = ids.map(id => getOptionName(id)).join(', ')
                }
            }

            const price = isKitchen ? '' : `<div style="text-align:right">${(item.price_at_time * item.quantity).toLocaleString()}.-</div>`

            return `
                <div style="margin-bottom: 8px; border-bottom: 1px dashed #ddd; padding-bottom: 4px;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold;">
                        <span>${item.quantity}x ${name}</span>
                        ${price}
                    </div>
                    ${opts ? `<div style="font-size: 12px; color: #555; margin-left: 20px;">+ ${opts}</div>` : ''}
                </div>
            `
        }).join('') || '<div style="text-align:center; color:#999">No items</div>'

        const discountHtml = booking.discount_amount > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #000; font-size: 14px; margin-top: 10px;">
                <span>Discount (${booking.promotion_codes?.code || 'PROMO'})</span>
                <span>-${booking.discount_amount.toLocaleString()}.-</span>
            </div>
        ` : ''

        const totalHtml = isKitchen ? '' : `
            <div style="margin-top: 20px; padding-top: 10px; border-top: 2px solid #000;">
                ${discountHtml}
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; margin-top: 5px;">
                    <span>TOTAL</span>
                    <span>${booking.total_amount?.toLocaleString()}.-</span>
                </div>
            </div>
        `
        const noteHtml = booking.customer_note ? `
            <div style="margin-top: 10px; padding: 10px; background: #eee; border-radius: 4px; font-size: 12px;">
                <strong>Note:</strong> ${booking.customer_note}
            </div>
        ` : ''

        const printWindow = window.open('', '_blank', 'width=400,height=600')
        printWindow.document.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
                        h1 { text-align: center; margin-bottom: 5px; font-size: 24px; }
                        .meta { margin-bottom: 20px; font-size: 12px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                        @media print { body { -webkit-print-color-adjust: exact; } }
                    </style>
                </head>
                <body>
                    <h1>${isKitchen ? '👨‍🍳 KITCHEN' : '🧾 IN THE HAUS'}</h1>
                    <div style="text-align: center; margin-bottom: 20px; font-weight: bold;">${title}</div>
                    
                    <div class="meta">
                        <div>Table: <strong style="font-size: 16px;">${tableName}</strong></div>
                        <div>Date: ${dateStr}</div>
                        <div>Order ID: #${booking.id.slice(0, 8)}</div>
                        ${!isKitchen ? `<div>Customer: ${booking.profiles?.display_name ? `คุณ ${booking.profiles.display_name}` : (booking.pickup_contact_name || '-')}</div>` : ''}
                    </div>

                    <div style="margin-bottom: 20px;">${itemsHtml}</div>
                    ${totalHtml}
                    ${noteHtml}

                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `)
        printWindow.document.close()
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden max-w-md w-full shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center text-white">
                    <h3 className="font-bold">Preview Slip ({type})</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
                </div>

                {/* Preview Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#333] flex justify-center">
                    <div
                        ref={slipRef}
                        className="bg-white text-black p-6 w-[350px] shadow-lg text-sm font-mono min-h-[400px]"
                    >
                        {/* Header */}
                        <div className="text-center mb-4">
                            <h1 className="text-xl font-bold mb-1">{isKitchen ? '👨‍🍳 KITCHEN' : '🧾 IN THE HAUS'}</h1>
                            <div className="text-xs uppercase font-bold tracking-widest">{title}</div>
                        </div>

                        {/* Meta */}
                        <div className="border-b-2 border-black pb-3 mb-4 text-xs space-y-1">
                            <div className="flex justify-between"><span>Table:</span> <span className="font-bold text-base">{booking.tables_layout?.table_name || 'N/A'}</span></div>
                            <div className="flex justify-between"><span>Date:</span> <span>{new Date(booking.booking_time).toLocaleString('th-TH')}</span></div>
                            <div className="flex justify-between"><span>Order ID:</span> <span>#{booking.id.slice(0, 8)}</span></div>
                            {!isKitchen && <div className="flex justify-between"><span>Customer:</span> <span>{booking.profiles?.display_name ? `คุณ ${booking.profiles.display_name}` : (booking.pickup_contact_name || '-')}</span></div>}
                        </div>

                        {/* Items */}
                        <div className="space-y-3 mb-4">
                            {booking.order_items?.map((item, idx) => {
                                // Map Options in Render
                                let optionText = ''
                                if (item.selected_options) {
                                    const ids = Object.values(item.selected_options).flat()
                                    optionText = ids.map(id => optionMap[id] || id).join(', ')
                                }

                                return (
                                    <div key={idx} className="border-b border-dashed border-gray-300 pb-2">
                                        <div className="flex justify-between font-bold">
                                            <span>{item.quantity}x {item.menu_items?.name}</span>
                                            {!isKitchen && <span>{(item.price_at_time * item.quantity).toLocaleString()}</span>}
                                        </div>
                                        {optionText && (
                                            <div className="text-[10px] text-gray-500 ml-4 mt-0.5">
                                                + {optionText}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            {(!booking.order_items || booking.order_items.length === 0) && <div className="text-center text-gray-400 italic">No items</div>}
                        </div>

                        {/* Total or Note */}
                        {!isKitchen && (
                            <div className="border-t-2 border-black pt-2 mt-6">
                                {booking.discount_amount > 0 && (
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Discount ({booking.promotion_codes?.code || 'PROMO'})</span>
                                        <span>-{booking.discount_amount.toLocaleString()}.-</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-lg">
                                    <span>TOTAL</span>
                                    <span>{booking.total_amount?.toLocaleString()}.-</span>
                                </div>
                            </div>
                        )}

                        {booking.customer_note && (
                            <div className="mt-4 bg-gray-100 p-2 rounded text-xs">
                                <strong>Note:</strong> {booking.customer_note}
                            </div>
                        )}

                        <div className="text-center mt-8 text-[10px] text-gray-400">
                            {isKitchen ? 'Please prepare asap' : 'Thank you for dining with us!'}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-white/10 flex gap-3 bg-[#111]">
                    <button
                        onClick={handlePrint}
                        className="flex-1 bg-white text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                    >
                        <Printer size={18} /> Print Only
                    </button>
                    <button
                        onClick={handleSaveImage}
                        disabled={saving}
                        className="flex-1 bg-[#DFFF00] text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#cbe600] transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : <><Download size={18} /> Save Image</>}
                    </button>
                </div>
            </div>

            {/* Close Overlay (Optional, though modal backdrop handles blocking interactions, 
             the user asked for a "Close button" which is already included in the header of the modal. 
             If they want another one, I can add it, but the one in header is standard. 
             I will assume header X is sufficient.) */}
        </div>
    )
}
