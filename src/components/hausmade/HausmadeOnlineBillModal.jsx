/* Hallmark · component: HausmadeOnlineBillModal · theme: Atelier (Thai Modern OKLCH)
 * features: High-Res Retina PNG Export, Dynamic Shipping Fee Adjustment, PromptPay QR, 1-Click Clipboard Image Copy
 */
import React, { useRef, useState, useMemo } from 'react'
import { toPng } from 'html-to-image'
import { QRCodeSVG } from 'qrcode.react'
import generatePayload from 'promptpay-qr'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabaseClient'

export default function HausmadeOnlineBillModal({
    order,
    senderInfo = {},
    onClose,
    onOrderUpdated
}) {
    const billRef = useRef(null)
    const [isExporting, setIsExporting] = useState(false)
    const [isCopyingImage, setIsCopyingImage] = useState(false)
    const [isSavingDb, setIsSavingDb] = useState(false)

    // Dynamic Shipping Fee (Initialized from order or default)
    const initialShippingFee = order?.shipping_fee !== undefined ? Number(order.shipping_fee) : (senderInfo.shippingFee || 50)
    const [customShippingFee, setCustomShippingFee] = useState(initialShippingFee)

    // Sync customShippingFee when order changes
    React.useEffect(() => {
        if (order?.shipping_fee !== undefined) {
            setCustomShippingFee(Number(order.shipping_fee))
        }
    }, [order?.shipping_fee])

    // Customer & Order Data Normalization
    const customerName = order?.pickup_contact_name || order?.guest_name || order?.customer_name || 'ลูกค้า HAUSMADE'
    const customerPhone = order?.pickup_contact_phone || order?.phone_number || '-'
    const shippingAddress = order?.shipping_address || 'รับหน้าร้าน IN THE HAUS (นครพนม)'
    const trackingToken = order?.tracking_token || order?.id || `HM-${Date.now().toString(36).toUpperCase()}`
    const courierName = order?.courier_name || 'Flash Express'
    const trackingNumber = order?.tracking_number || ''
    const orderDate = new Date(order?.created_at || Date.now())

    // Financial Computations
    const subtotal = useMemo(() => {
        if (!order) return 0
        if (order.order_items && order.order_items.length > 0) {
            return order.order_items.reduce((sum, item) => {
                const price = Number(item.price_at_time || item.menu_items?.price || item.price || 0)
                const qty = Number(item.quantity || 1)
                return sum + (price * qty)
            }, 0)
        }
        // Fallback: total_amount minus original shipping
        const origShipping = Number(order.shipping_fee || 0)
        return Math.max(0, Number(order.total_amount || 0) - origShipping)
    }, [order])

    const discountAmount = Number(order?.discount_amount || order?.xhaus_discount || 0)
    const finalTotal = Math.max(0, (subtotal - discountAmount) + Number(customShippingFee))

    // PromptPay QR Payload Generation
    const promptpayAccount = senderInfo.storePhone || senderInfo.senderPhone || '0985284217'
    const sanitizedPromptpay = promptpayAccount.replace(/[^0-9]/g, '')
    
    const qrPayload = useMemo(() => {
        try {
            if (sanitizedPromptpay && finalTotal > 0) {
                return generatePayload(sanitizedPromptpay, { amount: finalTotal })
            }
        } catch (e) {
            console.warn('Failed to generate PromptPay QR payload:', e)
        }
        return ''
    }, [sanitizedPromptpay, finalTotal])

    if (!order) return null

    // Save custom shipping fee to database
    const handleSaveShippingFeeToDb = async () => {
        setIsSavingDb(true)
        try {
            let { error } = await supabase
                .from('bookings')
                .update({
                    shipping_fee: customShippingFee,
                    total_amount: finalTotal
                })
                .eq('id', order.id)

            if (error && error.message && error.message.includes('column')) {
                console.warn('[HausmadeOnlineBillModal] shipping_fee column not found, updating total_amount:', error.message)
                const fallbackRes = await supabase
                    .from('bookings')
                    .update({
                        total_amount: finalTotal
                    })
                    .eq('id', order.id)

                if (fallbackRes.error) throw fallbackRes.error
            } else if (error) {
                throw error
            }

            toast.success(`บันทึกค่าจัดส่ง ฿${customShippingFee}.- และยอดรวม ฿${finalTotal.toLocaleString()}.- สำเร็จ`)
            if (onOrderUpdated) {
                onOrderUpdated({
                    ...order,
                    shipping_fee: customShippingFee,
                    total_amount: finalTotal
                })
            }
        } catch (err) {
            console.error('Error updating shipping fee:', err)
            toast.error('ไม่สามารถบันทึกค่าจัดส่งได้: ' + err.message)
        } finally {
            setIsSavingDb(false)
        }
    }

    // 1. Download Bill as High-Resolution PNG
    const handleDownloadPng = async () => {
        if (!billRef.current || isExporting) return
        setIsExporting(true)
        const toastId = toast.loading('กำลังประมวลผลรูปภาพบิลความละเอียดสูง...')

        try {
            const dataUrl = await toPng(billRef.current, {
                pixelRatio: 3,
                quality: 1.0,
                cacheBust: true,
                skipFonts: true,
                fontEmbedCSS: '',
                style: {
                    transform: 'none',
                    margin: '0',
                    boxShadow: 'none'
                }
            })

            const filename = `HAUSMADE-BILL-${trackingToken}.png`
            const link = document.createElement('a')
            link.download = filename
            link.href = dataUrl
            link.click()

            toast.success('บันทึกรูปภาพบิลเรียบร้อยแล้ว (PNG)', { id: toastId })
        } catch (err) {
            console.error('Download PNG failed:', err)
            toast.error('ไม่สามารถบันทึกภาพได้: ' + err.message, { id: toastId })
        } finally {
            setIsExporting(false)
        }
    }

    // 2. Copy Bill Image directly to Clipboard for LINE / IG
    const handleCopyImageToClipboard = async () => {
        if (!billRef.current || isCopyingImage) return
        setIsCopyingImage(true)
        const toastId = toast.loading('กำลังคัดลอกรูปภาพบิลลง Clipboard...')

        try {
            const dataUrl = await toPng(billRef.current, {
                pixelRatio: 2.5,
                quality: 1.0,
                cacheBust: true,
                skipFonts: true,
                fontEmbedCSS: '',
                style: {
                    transform: 'none',
                    margin: '0',
                    boxShadow: 'none'
                }
            })

            const res = await fetch(dataUrl)
            const blob = await res.blob()

            if (navigator.clipboard && window.ClipboardItem) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ])
                toast.success('คัดลอกรูปภาพบิลสำเร็จ! (กด Ctrl+V วางในแชท LINE ได้ทันที)', { id: toastId, duration: 4000 })
            } else {
                // Fallback: download if clipboard API unavailable
                const link = document.createElement('a')
                link.download = `HAUSMADE-BILL-${trackingToken}.png`
                link.href = dataUrl
                link.click()
                toast.info('เบราว์เซอร์ไม่รองรับ Clipboard Image ตรง ได้ทำการดาวน์โหลดรูปภาพให้แทน', { id: toastId })
            }
        } catch (err) {
            console.error('Copy Image Clipboard failed:', err)
            toast.error('ไม่สามารถคัดลอกภาพได้: ' + err.message, { id: toastId })
        } finally {
            setIsCopyingImage(false)
        }
    }

    // 3. Copy Text Summary Quote
    const handleCopyTextQuote = () => {
        const itemsText = (order.order_items || [])
            .map((item, idx) => {
                const name = item.menu_items?.name || item.name || 'สินค้า HAUSMADE'
                const opts = item.selected_options ? ` (${item.selected_options})` : ''
                const price = Number(item.price_at_time || item.menu_items?.price || item.price || 0)
                return `${idx + 1}. ${name}${opts} x${item.quantity} = ฿${(price * item.quantity).toLocaleString()}.-`
            })
            .join('\n')

        const quote = `🧾 [สรุปยอดสั่งซื้อ HAUSMADE // IN THE HAUS]
TOKEN: ${trackingToken}
ผู้รับ: ${customerName} (โทร: ${customerPhone})
ที่อยู่จัดส่ง: ${shippingAddress}

📦 รายการสินค้า:
${itemsText || '- รายการสินค้าตามสลิป -'}

💵 สรุปยอดเงิน:
- ค่าสินค้า: ฿${subtotal.toLocaleString()}.-
${discountAmount > 0 ? `- ส่วนลด: -฿${discountAmount.toLocaleString()}.-` : ''}
- ค่าจัดส่ง (${courierName}): ฿${Number(customShippingFee).toLocaleString()}.-
👉 ยอดสุทธิที่ต้องชำระ: ฿${finalTotal.toLocaleString()}.-

🏦 ช่องทางชำระเงิน:
ธนาคาร: ${senderInfo.bankName || 'กสิกรไทย (KBank)'}
เลขบัญชี: ${senderInfo.bankAccountNo || '123-4-56789-0'}
ชื่อบัญชี: ${senderInfo.bankAccountName || 'บจก. อิน เดอะ เฮาส์'}
พร้อมเพย์: ${sanitizedPromptpay || '098-528-4217'}

* ชำระเงินแล้ว รบกวนส่งสลิปยืนยันกลับทางแชทนี้ได้เลยครับ ขอบคุณครับ 🙏`

        navigator.clipboard.writeText(quote)
        toast.success('คัดลอกข้อความสรุปยอดเรียบร้อยแล้ว')
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md overflow-y-auto font-mono select-none">
            
            {/* Modal Dialog Window */}
            <div className="relative w-full max-w-2xl bg-[var(--color-paper)] border border-[var(--color-rule)] shadow-2xl flex flex-col my-auto max-h-[95vh] overflow-hidden">
                
                {/* 1. Header Toolbar (Non-Exported) */}
                <div className="bg-[var(--color-ink)] text-[var(--color-paper)] px-5 py-3.5 border-b border-[var(--color-rule)] flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-xs uppercase tracking-wider text-[var(--brand-plum)]">
                            [ ONLINE BILL GENERATOR ]
                        </span>
                        <span className="text-[10px] text-[var(--color-neutral)] hidden sm:inline">
                            // TOKEN: {trackingToken}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopyImageToClipboard}
                            disabled={isCopyingImage}
                            className="px-3 py-1.5 bg-[var(--brand-plum)] hover:opacity-90 text-white text-xs font-bold uppercase transition-opacity flex items-center gap-1.5 cursor-pointer shadow-2xs rounded-xs disabled:opacity-50 whitespace-nowrap"
                            title="คัดลอกภาพบิลเพื่อวางใน LINE / IG แชททันที"
                        >
                            <span>[ คัดลอกภาพ LINE ]</span>
                        </button>

                        <button
                            onClick={handleDownloadPng}
                            disabled={isExporting}
                            className="px-3 py-1.5 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] text-xs font-bold uppercase border border-[var(--color-rule)] transition-colors flex items-center gap-1.5 cursor-pointer rounded-xs disabled:opacity-50 whitespace-nowrap"
                        >
                            <span>[ บันทึก PNG ]</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="px-2.5 py-1.5 border border-[var(--color-rule)] text-[var(--color-rule)] hover:text-white uppercase text-xs transition-colors rounded-xs cursor-pointer"
                        >
                            [ ✕ ]
                        </button>
                    </div>
                </div>

                {/* 2. Control Panel: Dynamic Shipping Adjuster (Non-Exported) */}
                <div className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-[var(--color-neutral)] text-[10px] uppercase">
                            [ ปรับค่าจัดส่งรายบิล ]:
                        </span>
                        
                        {/* Quick Preset Buttons */}
                        <div className="inline-flex items-center border border-[var(--color-rule)] bg-[var(--color-paper)] rounded-xs overflow-hidden divide-x divide-[var(--color-rule)]">
                            {[
                                { fee: 0, label: 'ฟรี (0.-)' },
                                { fee: 50, label: 'ปกติ (50.-)' },
                                { fee: 80, label: 'ห่างไกล (80.-)' },
                                { fee: 100, label: 'ด่วน (100.-)' }
                            ].map(p => (
                                <button
                                    key={p.fee}
                                    type="button"
                                    onClick={() => setCustomShippingFee(p.fee)}
                                    className={`px-2.5 py-1 text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                                        customShippingFee === p.fee
                                            ? 'bg-[var(--color-ink)] text-white'
                                            : 'text-[var(--color-muted)] hover:bg-[var(--color-paper-2)]'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Custom Input */}
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[var(--color-neutral)]">กำหนดเอง:</span>
                            <input
                                type="number"
                                min="0"
                                value={customShippingFee}
                                onChange={(e) => setCustomShippingFee(Math.max(0, Number(e.target.value)))}
                                className="w-16 px-2 py-0.5 bg-[var(--color-paper)] border border-[var(--color-rule)] text-xs font-bold text-center focus:outline-none focus:border-[var(--brand-plum)] rounded-xs tabular-nums"
                            />
                            <span className="text-[10px]">.-</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {customShippingFee !== Number(order.shipping_fee || 0) && (
                            <button
                                type="button"
                                onClick={handleSaveShippingFeeToDb}
                                disabled={isSavingDb}
                                className="px-2.5 py-1 bg-[oklch(45%_0.08_140)] text-white font-bold text-[10px] uppercase hover:opacity-90 transition-opacity rounded-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                                {isSavingDb ? '...' : '[ บันทึกลงออเดอร์ ]'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleCopyTextQuote}
                            className="px-2.5 py-1 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] font-bold text-[10px] uppercase hover:bg-[var(--color-paper-2)] transition-colors rounded-xs cursor-pointer whitespace-nowrap"
                        >
                            [ คัดลอกข้อความ ]
                        </button>
                    </div>
                </div>

                {/* 3. Canvas Container (Scrollable Preview) */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-grow bg-[var(--color-paper-2)] flex justify-center items-start">
                    
                    {/* --- HIGH-RES PRINTABLE & EXPORTABLE BILL CANVAS --- */}
                    <div
                        ref={billRef}
                        id="hausmade-bill-canvas"
                        className="w-full max-w-[540px] bg-[var(--color-paper)] text-[var(--color-ink)] border-2 border-[var(--color-ink)] p-6 sm:p-7 flex flex-col gap-5 shadow-lg relative"
                    >
                        {/* Top Perforated Decorative Bar */}
                        <div className="flex justify-between items-center border-b-2 border-dashed border-[var(--color-ink)] pb-4">
                            <div>
                                <span className="font-mono text-[9px] font-bold text-[var(--brand-plum)] uppercase tracking-widest block">
                                    // CRAFT GOODS & RETAIL STORE
                                </span>
                                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[var(--color-ink)]">
                                    HAUSMADE
                                </h1>
                                <span className="text-[10px] text-[var(--color-muted)] block">
                                    BY IN THE HAUS · NAKHON PHANOM, THAILAND
                                </span>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-xs ${
                                    order.is_preorder || (order.customer_note && order.customer_note.includes('PRE-ORDER'))
                                        ? 'bg-[oklch(45%_0.08_140)] text-white'
                                        : 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                }`}>
                                    {order.is_preorder || (order.customer_note && order.customer_note.includes('PRE-ORDER'))
                                        ? '[ PRE-ORDER INVOICE ]'
                                        : '[ OFFICIAL INVOICE ]'
                                    }
                                </span>
                                <span className="text-xs font-bold mt-1.5 text-[var(--brand-plum)] tabular-nums">
                                    {trackingToken}
                                </span>
                                <span className="text-[9px] text-[var(--color-neutral)] tabular-nums">
                                    DATE: {orderDate.toLocaleDateString('th-TH')} {orderDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>

                        {/* Recipient & Shipping Information */}
                        <div className="border border-[var(--color-ink)] p-3.5 bg-[var(--color-paper-2)] flex flex-col gap-1.5 text-xs rounded-xs">
                            <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-1 mb-0.5">
                                <span className="font-bold text-[10px] text-[var(--color-neutral)] uppercase">
                                    [ RECIPIENT INFORMATION // ข้อมูลผู้รับ ]
                                </span>
                                <span className="text-[10px] font-bold text-[oklch(45%_0.08_140)]">
                                    {order.order_type === 'hausmade_shipping' ? `[ ${courierName} ]` : '[ รับหน้าร้าน ]'}
                                </span>
                            </div>
                            
                            <div className="font-bold text-sm text-[var(--color-ink)]">
                                {customerName} <span className="text-xs font-normal text-[var(--color-muted)] tabular-nums">(TEL: {customerPhone})</span>
                            </div>
                            
                            <div className="text-[11px] leading-relaxed text-[var(--color-ink)] font-sans font-medium">
                                {shippingAddress}
                            </div>

                            {order.customer_note && (
                                <div className="mt-1 text-[10px] text-[var(--brand-plum)] font-bold border-t border-[var(--color-rule)] pt-1">
                                    NOTE: {order.customer_note}
                                </div>
                            )}

                            {trackingNumber && (
                                <div className="mt-0.5 font-bold text-[11px] text-[var(--color-ink)]">
                                    TRACKING #: <span className="bg-[var(--color-paper)] px-1.5 py-0.5 border border-[var(--color-rule)] tabular-nums">{trackingNumber}</span>
                                </div>
                            )}
                        </div>

                        {/* Order Items Table */}
                        <div className="flex flex-col gap-1">
                            <span className="font-bold text-[10px] text-[var(--color-neutral)] uppercase block mb-1">
                                [ ORDERED ITEMS // รายการสินค้า ]
                            </span>
                            
                            <table className="w-full text-left border-collapse border border-[var(--color-ink)] text-[11px]">
                                <thead>
                                    <tr className="bg-[var(--color-ink)] text-[var(--color-paper)]">
                                        <th className="p-2 border-r border-[var(--color-rule)]/30 text-center w-8">#</th>
                                        <th className="p-2 border-r border-[var(--color-rule)]/30">DESCRIPTION</th>
                                        <th className="p-2 border-r border-[var(--color-rule)]/30 text-center w-12">QTY</th>
                                        <th className="p-2 text-right w-20">AMOUNT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.order_items && order.order_items.length > 0 ? (
                                        order.order_items.map((item, idx) => {
                                            const price = Number(item.price_at_time || item.menu_items?.price || item.price || 0)
                                            const itemTotal = price * Number(item.quantity || 1)
                                            return (
                                                <tr key={idx} className="border-b border-[var(--color-rule)] last:border-b-0">
                                                    <td className="p-2 border-r border-[var(--color-rule)] text-center text-[10px] text-[var(--color-neutral)] tabular-nums">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="p-2 border-r border-[var(--color-rule)]">
                                                        <div className="font-bold text-[var(--color-ink)]">
                                                            {item.menu_items?.name || item.name || 'HAUSMADE CRAFT ITEM'}
                                                        </div>
                                                        {item.selected_options && (
                                                            <div className="text-[9px] text-[var(--brand-plum)] font-medium mt-0.5">
                                                                {item.selected_options}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 border-r border-[var(--color-rule)] text-center font-bold tabular-nums">
                                                        {item.quantity}
                                                    </td>
                                                    <td className="p-2 text-right font-bold text-[var(--color-ink)] tabular-nums">
                                                        ฿{itemTotal.toLocaleString()}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    ) : (
                                        <tr className="border-b border-[var(--color-rule)]">
                                            <td colSpan="4" className="p-3 text-center text-xs text-[var(--color-neutral)] tabular-nums">
                                                HAUSMADE CRAFT ORDER (TOTAL: ฿{finalTotal.toLocaleString()}.-)
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Financial Totals Breakdown */}
                        <div className="flex justify-end">
                            <div className="w-full sm:w-64 border border-[var(--color-ink)] bg-[var(--color-paper-2)] p-3 flex flex-col gap-1.5 text-xs rounded-xs">
                                <div className="flex justify-between text-[var(--color-neutral)]">
                                    <span>SUBTOTAL:</span>
                                    <span className="font-bold text-[var(--color-ink)] tabular-nums">฿{subtotal.toLocaleString()}.-</span>
                                </div>

                                {discountAmount > 0 && (
                                    <div className="flex justify-between text-[oklch(45%_0.08_140)] font-bold">
                                        <span>DISCOUNT:</span>
                                        <span className="tabular-nums">-฿{discountAmount.toLocaleString()}.-</span>
                                    </div>
                                )}

                                <div className="flex justify-between text-[var(--color-neutral)]">
                                    <span>SHIPPING ({courierName}):</span>
                                    <span className="font-bold text-[var(--color-ink)] tabular-nums">
                                        {Number(customShippingFee) === 0 ? 'FREE' : `฿${Number(customShippingFee).toLocaleString()}.-`}
                                    </span>
                                </div>

                                <div className="border-t border-[var(--color-ink)] pt-2 mt-1 flex justify-between items-baseline font-bold">
                                    <span className="text-xs uppercase text-[var(--color-ink)]">TOTAL DUE:</span>
                                    <span className="text-base text-[var(--brand-plum)] font-black tabular-nums">
                                        ฿{finalTotal.toLocaleString()}.-
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Payment & Bank Details Container */}
                        <div className="border-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-3.5 flex flex-col sm:flex-row items-center gap-4 rounded-xs">
                            {/* QR Code Container */}
                            <div className="flex-shrink-0 flex flex-col items-center bg-white p-2 border border-[var(--color-rule)] shadow-2xs rounded-xs">
                                {qrPayload ? (
                                    <QRCodeSVG
                                        value={qrPayload}
                                        size={120}
                                        level="M"
                                        includeMargin={false}
                                    />
                                ) : senderInfo.paymentQrUrl ? (
                                    <img
                                        src={senderInfo.paymentQrUrl}
                                        alt="PromptPay QR"
                                        className="w-28 h-28 object-contain"
                                    />
                                ) : (
                                    <div className="w-28 h-28 border border-dashed border-[var(--color-rule)] flex items-center justify-center text-[9px] text-center text-[var(--color-neutral)] p-2">
                                        [ PROMPTPAY QR ]
                                    </div>
                                )}
                                <span className="text-[8px] font-bold tracking-wider text-[var(--color-neutral)] uppercase mt-1">
                                    PROMPTPAY QR
                                </span>
                            </div>

                            {/* Bank Details */}
                            <div className="flex flex-col gap-1 text-[11px] flex-grow text-center sm:text-left">
                                <span className="font-bold text-[10px] text-[var(--brand-plum)] uppercase tracking-wider">
                                    [ บัญชีสำหรับโอนชำระเงิน ]
                                </span>
                                <div className="font-bold text-xs text-[var(--color-ink)]">
                                    {senderInfo.bankName || 'ธนาคารกสิกรไทย (KBank)'}
                                </div>
                                <div className="text-xs font-mono font-bold bg-[var(--color-paper-2)] px-2 py-0.5 border border-[var(--color-rule)] inline-block self-center sm:self-start rounded-xs tabular-nums">
                                    {senderInfo.bankAccountNo || '123-4-56789-0'}
                                </div>
                                <div className="text-[10px] text-[var(--color-muted)]">
                                    ชื่อบัญชี: {senderInfo.bankAccountName || 'บจก. อิน เดอะ เฮาส์ (IN THE HAUS)'}
                                </div>
                                <div className="text-[9px] text-[var(--color-neutral)] mt-1">
                                    * โอนชำระแล้ว รบกวนส่งสลิปยืนยันกลับทางแชทนี้ครับ
                                </div>
                            </div>
                        </div>

                        {/* Bottom Disclaimer & Verification Stamp */}
                        <div className="border-t-2 border-dashed border-[var(--color-ink)] pt-3 flex justify-between items-center text-[8px] text-[var(--color-neutral)]">
                            <div>
                                VERIFIED DISPATCH · IN THE HAUS CRAFT STORE<br />
                                <span className="tabular-nums">TEL: {senderInfo.senderPhone || '098-528-4217'}</span> | LINE: @inthehaus
                            </div>
                            <div className="border border-[var(--color-ink)] px-2 py-1 font-bold text-[8px] uppercase text-[var(--color-ink)] rounded-xs">
                                [ STAMPED // AUTHENTIC ]
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Footer Dismiss Bar */}
                <div className="bg-[var(--color-paper-2)] border-t border-[var(--color-rule)] p-3 flex justify-between items-center flex-shrink-0 text-xs">
                    <span className="text-[10px] text-[var(--color-neutral)]">
                        [ TIP ]: คลิกปุ่ม "[ คัดลอกภาพ LINE ]" เพื่อนำภาพไปวางในแชทได้ทันที
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--brand-plum)] font-bold uppercase transition-colors text-xs cursor-pointer rounded-xs"
                    >
                        [ ปิดหน้าต่าง ]
                    </button>
                </div>
            </div>
        </div>
    )
}
