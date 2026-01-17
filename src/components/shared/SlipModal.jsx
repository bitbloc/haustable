import { useRef, useState, useEffect } from 'react'
import { X, Printer, Download, Check } from 'lucide-react'
import { toPng } from 'html-to-image'
import { supabase } from '../../lib/supabaseClient'


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

    // Generate HTML for Print
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

        // Jagged Edge CSS (Simulated with clip-path for print support varies, but SVG background is better for image gen. 
        // For simple print HTML, we might just use border dashed or simple lines if pure CSS jagged is too complex for basic window.print implementation.
        // But for the "Visual" preview and "Save Image", we will use the full CSS.
        // For print, we'll keep it cleaner or try to replicate basic look.
        
        return `
            <html>
                <head>
                    <title>Ticket #${booking.tracking_token || booking.id.slice(0,4)}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@900&display=swap'); /* For HEAVY header */

                        body { 
                            font-family: 'Courier Prime', 'Courier New', monospace; 
                            background: white; 
                            color: black; 
                            font-size: 11px; 
                            margin: 0; 
                            padding: 20px 10px;
                            width: 300px;
                        }
                        .brand { 
                            font-family: 'Inter', sans-serif; 
                            font-size: 28px; 
                            font-weight: 900; 
                            text-align: center; 
                            text-transform: uppercase; 
                            letter-spacing: -1px;
                            margin-bottom: 5px;
                            line-height: 1;
                        }
                        .order-id {
                            text-align: center;
                            font-size: 18px;
                            font-weight: bold;
                            border: 2px solid black;
                            display: inline-block;
                            padding: 2px 8px;
                            margin: 5px auto 15px auto;
                            border-radius: 4px;
                            background: black;
                            color: white;
                        }
                        .center-flex { display: flex; justify-content: center; }

                        .meta { border-top: 2px dashed black; border-bottom: 2px dashed black; padding: 10px 0; margin-bottom: 15px; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                        .label { color: #000; font-weight: bold; text-transform: uppercase; }
                        .val { font-weight: normal; text-align: right; }
                        
                        .items { margin-bottom: 15px; }
                        .item { margin-bottom: 10px; }
                        .qty { width: 25px; font-weight: bold; flex-shrink: 0; font-size: 12px; }
                        .name { flex-grow: 1; margin-right: 5px; font-weight: bold; text-transform: uppercase; }
                        .price { text-align: right; width: 60px; flex-shrink: 0; }
                        .opts { margin-left: 25px; margin-top: 2px; color: #555; font-size: 9px; font-style: italic; }

                        .totals { border-top: 2px solid black; padding-top: 10px; margin-bottom: 15px; }
                        .total-row { font-size: 16px; font-weight: bold; margin-top: 5px; }
                        
                        .note { border: 1px solid black; padding: 8px; margin-top: 10px; font-size: 10px; font-weight: bold; }
                        .note-label { background: black; color: white; display: inline-block; padding: 1px 4px; margin-bottom: 4px; font-size: 9px; }

                         /* Jagged edges for print are tricky, using dashed border as fallback style */
                        .zigzag-top, .zigzag-bottom {
                            display: none; /* Hide in basic print, rely on clean dashed lines */
                        }

                        .footer { text-align: center; margin-top: 20px; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
                        @media print { body { width: 100%; padding: 10px; } }
                    </style>
                </head>
                <body>
                    <div class="brand">INTHEHAUS</div>
                    <div class="center-flex">
                        <div class="order-id">#${booking.tracking_token || booking.id.slice(0, 4)}</div>
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
                        <div class="row"><span>Subtotal</span> <span>-</span></div>
                        ${discountHtml}
                        <div class="row total-row">
                            <span>TOTAL</span>
                            <span>${booking.total_amount?.toLocaleString()}</span>
                        </div>
                    </div>

                    ${noteHtml}

                    <div class="footer">
                        THANK YOU FOR DINING WITH US
                        <br/>
                        smallfry.world
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
            const dataUrl = await toPng(slipRef.current, { 
                cacheBust: true, 
                backgroundColor: 'transparent', // Transparent to let shadow/rotation show if needed involved in parent? No, element itself has styles.
                pixelRatio: 3 
            })
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

    // --- VISUAL RENDER (Matches "Small Fry" Style) ---
    // Using CSS Clip-path for jagged edges
    const jaggedCss = `
        .ticket-visual {
            position: relative;
            background: #fff;
            filter: drop-shadow(0px 5px 15px rgba(0,0,0,0.15));
        }
        .ticket-visual::before, .ticket-visual::after {
            content: "";
            position: absolute;
            left: 0;
            width: 100%;
            height: 10px;
            background-size: 20px 20px;
            background-repeat: repeat-x;
        }
        .ticket-visual::before {
            top: -10px;
            background: radial-gradient(circle at 10px 15px, transparent 10px, #fff 11px);
            background-size: 20px 20px;
            transform: rotate(180deg);
        }
        .ticket-visual::after {
            bottom: -10px;
            background: radial-gradient(circle at 10px 15px, transparent 10px, #fff 11px);
            background-size: 20px 20px;
        }
    `

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <style>{jaggedCss}</style>
            <div className="bg-[#111] rounded-2xl overflow-hidden max-w-md w-full shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-4 flex justify-between items-center text-white border-b border-white/10">
                    <h3 className="font-bold text-sm tracking-widest uppercase">Ticket Preview</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={18} /></button>
                </div>

                {/* Preview Window */}
                <div className="flex-1 overflow-y-auto p-12 bg-[#2d5cdb] flex justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                    <div 
                        ref={slipRef} 
                        className="ticket-visual bg-[#fdfdfd] text-black pt-8 pb-10 px-8 w-[340px] rotate-[-1deg] hover:rotate-0 transition-transform duration-300 ease-out origin-top"
                        style={{ fontFamily: "'Courier Prime', 'Courier New', monospace" }}
                    >
                        {/* BRAND HEADER */}
                        <div className="text-center mb-6">
                            <h1 className="text-[36px] font-black leading-none tracking-tighter uppercase transform scale-y-110 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                                INTHEHAUS
                            </h1>
                            <p className="text-[9px] font-bold tracking-widest uppercase mb-4 border-b-2 border-dashed border-black pb-4">
                                Delicious Design • Fresh Code
                            </p>
                            
                            {/* Prominent Order ID */}
                            <div className="inline-block border-2 border-black rounded-md px-4 py-1">
                                <span className="text-sm font-bold block leading-none text-gray-500 uppercase tracking-wider text-[8px]">Order No.</span>
                                <span className="text-3xl font-black leading-none block">#{booking.tracking_token || booking.id.slice(0,4)}</span>
                            </div>
                        </div>

                        {/* Meta Grid */}
                        <div className="grid grid-cols-2 gap-y-2 text-[10px] font-bold border-b-2 border-dashed border-black pb-5 mb-5">
                            <div className="text-gray-500">TABLE / TYPE</div>
                            <div className="text-right uppercase">{booking.tables_layout?.table_name || 'PICKUP'}</div>
                            
                            <div className="text-gray-500">DATE</div>
                            <div className="text-right">{new Date(booking.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute:'2-digit' })}</div>
                            
                            <div className="text-gray-500">GUEST</div>
                            <div className="text-right truncate">{booking.profiles?.display_name || booking.pickup_contact_name || 'Guest'}</div>
                        </div>

                        {/* Items */}
                        <div className="space-y-4 mb-6">
                            <div className="text-[10px] font-black uppercase tracking-widest text-right mb-2 opacity-50">01. THE ORDER</div>
                            {booking.order_items?.map((item, idx) => {
                                let optionsList = []
                                if (Array.isArray(item.selected_options)) {
                                     optionsList = item.selected_options.map(opt => typeof opt === 'object' ? opt.name : opt)
                                } else if (typeof item.selected_options === 'object') {
                                    optionsList = Object.values(item.selected_options).flat().map(id => optionMap[id] || id)
                                }
                                
                                return (
                                    <div key={idx} className="text-xs group">
                                        <div className="flex justify-between font-bold items-baseline gap-2 mb-1">
                                            <span className="w-5 shrink-0 text-sm">{item.quantity}</span>
                                            <span className="grow font-black uppercase text-sm tracking-tight leading-4">{item.menu_items?.name}</span>
                                            <span className="shrink-0 font-mono font-normal">{(item.price_at_time * item.quantity).toLocaleString()}</span>
                                        </div>
                                        {optionsList.length > 0 && (
                                            <div className="pl-5 space-y-0.5 text-[10px] text-gray-500 font-medium italic border-l-2 border-gray-200 ml-1.5 pl-2">
                                                {optionsList.map((opt, i) => <div key={i}>{opt}</div>)}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Totals */}
                        <div className="border-t-2 border-black pt-4 mb-4">
                             {booking.discount_amount > 0 && (
                                <div className="flex justify-between text-xs mb-2 font-bold text-gray-500 dashed">
                                    <span>DISCOUNT</span>
                                    <span>-{booking.discount_amount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-end">
                                <span className="font-black text-sm uppercase tracking-widest">TOTAL AMOUNT</span>
                                <span className="font-black text-2xl leading-none">{booking.total_amount?.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Note */}
                        {booking.customer_note && (
                            <div className="bg-black text-white p-3 font-mono text-[10px] relative mb-6">
                                <div className="absolute -top-2 left-2 bg-black px-1 text-[8px] font-bold uppercase">Note for Kitchen</div>
                                {booking.customer_note}
                            </div>
                        )}
                        
                        {/* Footer */}
                        <div className="text-center mt-8 space-y-1">
                            <div className="text-[9px] font-black tracking-[0.2em] uppercase">The Best or Nothing</div>
                            <div className="text-[8px] font-mono text-gray-400">THANK YOU FOR YOUR VISIT</div>
                        </div>

                        {/* Zigzag Bottom Simulated visual check */}
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
