import React from 'react'

export default function HausmadeDocumentPrinter({ order, senderInfo, docType = 'label', onClose }) {
    if (!order) return null

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900/80 backdrop-blur-md items-center justify-center p-4 overflow-y-auto">
            {/* Top Toolbar (Non-printable) */}
            <div className="w-full max-w-2xl bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-6 py-3 border border-[oklch(85%_0.012_28)] flex items-center justify-between font-mono text-xs mb-4 print:hidden">
                <span>[ DOCUMENT GENERATOR // {docType === 'label' ? 'SHIPPING LABEL' : 'OFFICIAL RECEIPT'} ]</span>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-1.5 bg-[oklch(52%_0.16_28)] text-white font-bold uppercase hover:opacity-90 transition-opacity"
                    >
                        [ PRINT / พิมพ์เอกสาร ]
                    </button>
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 border border-[oklch(85%_0.012_28)] text-white uppercase hover:bg-white/10 transition-colors"
                    >
                        [ CLOSE ]
                    </button>
                </div>
            </div>

            {/* Printable Document Container */}
            <div className="w-full max-w-2xl bg-white text-black p-8 border border-zinc-300 shadow-2xl font-mono text-xs print:m-0 print:p-6 print:border-none print:shadow-none">
                {docType === 'label' ? (
                    /* --- SHIPPING LABEL (ใบจ่าหน้าพัสดุ & ใบแพ็คสินค้า) --- */
                    <div className="flex flex-col gap-6 border-2 border-black p-6">
                        {/* Header Banner */}
                        <div className="flex justify-between items-start border-b-2 border-black pb-4">
                            <div>
                                <span className="font-bold text-sm uppercase block">
                                    HAUSMADE // PARCEL SHIPPING LABEL
                                </span>
                                <span className="text-[10px] text-zinc-600 block mt-0.5">
                                    EXPRESS DELIVERY SERVICE
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-xs block">
                                    TOKEN: {order.tracking_token || order.id}
                                </span>
                                <span className="text-[10px] text-zinc-600 block">
                                    DATE: {new Date(order.created_at || Date.now()).toLocaleDateString('th-TH')}
                                </span>
                            </div>
                        </div>

                        {/* Sender & Recipient Box */}
                        <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-4">
                            {/* Sender Details */}
                            <div className="border border-zinc-400 p-3 bg-zinc-50 flex flex-col gap-1">
                                <span className="font-bold text-[10px] uppercase text-zinc-500 block border-b border-zinc-300 pb-1 mb-1">
                                    [ SENDER // ผู้ส่ง ]
                                </span>
                                <span className="font-bold text-sm">{senderInfo.senderName}</span>
                                <span className="text-[11px] leading-tight">{senderInfo.senderAddress}</span>
                                <span className="font-bold text-xs mt-1">TEL: {senderInfo.senderPhone}</span>
                            </div>

                            {/* Recipient Details */}
                            <div className="border-2 border-black p-3 bg-white flex flex-col gap-1">
                                <span className="font-bold text-[10px] uppercase text-black block border-b border-black pb-1 mb-1">
                                    [ RECIPIENT // ผู้รับ ]
                                </span>
                                <span className="font-bold text-base">{order.pickup_contact_name || order.guest_name || 'ลูกค้า HAUSMADE'}</span>
                                <span className="text-[12px] font-bold leading-tight mt-0.5">{order.shipping_address || 'รับหน้าร้าน IN THE HAUS'}</span>
                                <span className="font-bold text-sm mt-1.5 text-black">TEL: {order.pickup_contact_phone || order.phone_number || '-'}</span>
                            </div>
                        </div>

                        {/* Order Items Checklist (Packing Check) */}
                        <div className="flex flex-col gap-2">
                            <span className="font-bold text-[10px] uppercase text-zinc-500">
                                [ PACKING CHECKLIST // รายการสินค้าในกล่อง ]
                            </span>
                            <table className="w-full text-left border-collapse border border-black text-[11px]">
                                <thead>
                                    <tr className="bg-zinc-100 border-b border-black">
                                        <th className="p-2 border-r border-black w-8 text-center">[✓]</th>
                                        <th className="p-2 border-r border-black">ITEM DESCRIPTION</th>
                                        <th className="p-2 text-center w-16">QTY</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.order_items?.map((item, idx) => (
                                        <tr key={idx} className="border-b border-zinc-300">
                                            <td className="p-2 border-r border-black text-center font-bold">[  ]</td>
                                            <td className="p-2 border-r border-black">
                                                <div className="font-bold">{item.menu_items?.name || 'HAUSMADE ITEM'}</div>
                                                {item.selected_options && (
                                                    <div className="text-[10px] text-zinc-600">{item.selected_options}</div>
                                                )}
                                            </td>
                                            <td className="p-2 text-center font-bold text-sm">{item.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Shipping Courier & Notes */}
                        <div className="flex justify-between items-center border-t-2 border-black pt-3">
                            <span className="font-bold text-xs">
                                COURIER: {order.courier_name || 'EXPRESS'} | TRACKING #: {order.tracking_number || 'PENDING'}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                                THANK YOU FOR CHOOSING HAUSMADE
                            </span>
                        </div>
                    </div>
                ) : (
                    /* --- OFFICIAL SALES RECEIPT (ใบเสร็จรับเงิน) --- */
                    <div className="flex flex-col gap-6 border-2 border-black p-6">
                        {/* Receipt Header */}
                        <div className="flex justify-between items-start border-b-2 border-black pb-4">
                            <div>
                                <h1 className="font-bold text-lg uppercase tracking-wider">{senderInfo.senderName}</h1>
                                <p className="text-[10px] text-zinc-600 max-w-sm mt-1 leading-relaxed">
                                    {senderInfo.senderAddress}<br />
                                    TAX ID: {senderInfo.senderTaxId} | TEL: {senderInfo.senderPhone}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-base uppercase block border border-black px-3 py-1 bg-zinc-100">
                                    OFFICIAL RECEIPT
                                </span>
                                <span className="text-[11px] font-bold block mt-2">
                                    NO: {order.tracking_token || `HM-${order.id}`}
                                </span>
                                <span className="text-[10px] text-zinc-600 block">
                                    DATE: {new Date(order.created_at || Date.now()).toLocaleDateString('th-TH')}
                                </span>
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div className="border border-black p-3 bg-zinc-50 flex flex-col gap-1">
                            <span className="font-bold text-[10px] uppercase text-zinc-500">
                                [ CUSTOMER // ลูกค้า ]
                            </span>
                            <div className="font-bold text-sm">{order.pickup_contact_name || order.guest_name || 'ลูกค้า HAUSMADE'} (TEL: {order.pickup_contact_phone || order.phone_number || '-'})</div>
                            <div className="text-xs">{order.shipping_address}</div>
                        </div>

                        {/* Items Table */}
                        <table className="w-full text-left border-collapse border border-black text-xs">
                            <thead>
                                <tr className="bg-zinc-100 border-b border-black">
                                    <th className="p-2 border-r border-black">DESCRIPTION</th>
                                    <th className="p-2 border-r border-black text-center w-16">QTY</th>
                                    <th className="p-2 border-r border-black text-right w-24">UNIT PRICE</th>
                                    <th className="p-2 text-right w-24">AMOUNT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.order_items?.map((item, idx) => {
                                    const price = item.price_at_time || item.menu_items?.price || 0
                                    const amount = price * item.quantity
                                    return (
                                        <tr key={idx} className="border-b border-zinc-300">
                                            <td className="p-2 border-r border-black">
                                                <div className="font-bold">{item.menu_items?.name}</div>
                                                {item.selected_options && (
                                                    <div className="text-[10px] text-zinc-600">{item.selected_options}</div>
                                                )}
                                            </td>
                                            <td className="p-2 border-r border-black text-center">{item.quantity}</td>
                                            <td className="p-2 border-r border-black text-right">฿{price.toLocaleString()}</td>
                                            <td className="p-2 text-right font-bold">฿{amount.toLocaleString()}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>

                        {/* Financial Totals */}
                        <div className="flex justify-end">
                            <div className="w-64 flex flex-col gap-1.5 border border-black p-3 bg-zinc-50 text-xs">
                                <div className="flex justify-between">
                                    <span>SUBTOTAL:</span>
                                    <span>฿{((order.total_amount || 0) - (order.shipping_fee || 0)).toLocaleString()}.-</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>SHIPPING FEE:</span>
                                    <span>฿{(order.shipping_fee || 0).toLocaleString()}.-</span>
                                </div>
                                <div className="flex justify-between font-bold text-sm border-t border-black pt-1.5 text-black">
                                    <span>TOTAL PAID:</span>
                                    <span>฿{(order.total_amount || 0).toLocaleString()}.-</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer Stamp */}
                        <div className="flex justify-between items-end border-t-2 border-black pt-4 mt-2">
                            <div className="text-[10px] text-zinc-500">
                                PAYMENT STATUS: PAID VIA PROMPTPAY<br />
                                STAMPED & VERIFIED BY HAUSMADE SYSTEM
                            </div>
                            <div className="border border-dashed border-black px-6 py-3 text-center font-bold text-xs uppercase">
                                [ SIGNATURE / STAMP ]
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
