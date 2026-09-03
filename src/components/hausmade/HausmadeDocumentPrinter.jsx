import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { getAppOrigin } from '../../utils/urlHelper'

export default function HausmadeDocumentPrinter({
    order,
    orders = [],
    senderInfo,
    docType = 'label', // 'label' | 'a4_stickers' | 'receipt'
    onClose
}) {
    const [selectedDocType, setSelectedDocType] = useState(docType)
    const orderList = orders.length > 0 ? orders : (order ? [order] : [])

    if (orderList.length === 0) return null

    const handlePrint = () => {
        window.print()
    }

    const origin = typeof window !== 'undefined' ? getAppOrigin() : 'https://inthehaus.cafe'

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900/85 backdrop-blur-md items-center justify-start p-4 overflow-y-auto">
            {/* Top Toolbar (Non-printable) */}
            <div className="w-full max-w-4xl bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-6 py-3 border border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between font-mono text-xs mb-4 gap-3 sticky top-4 z-10 shadow-xl print:hidden">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-[oklch(52%_0.16_28)]">
                        [ DOCUMENT STUDIO // {orderList.length} ORDERS ]
                    </span>
                    <div className="flex items-center border border-[oklch(85%_0.012_28)]/40 rounded p-0.5 bg-black/40">
                        <button
                            onClick={() => setSelectedDocType('a4_stickers')}
                            className={`px-2.5 py-1 text-[11px] rounded font-bold uppercase transition-all ${selectedDocType === 'a4_stickers' ? 'bg-[oklch(52%_0.16_28)] text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                            A4 สติกเกอร์ (4 ใบ/หน้า)
                        </button>
                        <button
                            onClick={() => setSelectedDocType('thermal_100x150')}
                            className={`px-2.5 py-1 text-[11px] rounded font-bold uppercase transition-all ${selectedDocType === 'thermal_100x150' ? 'bg-[oklch(52%_0.16_28)] text-white' : 'text-zinc-400 hover:text-white'}`}
                            title="สติกเกอร์ความร้อนขนาด 100x150 มม. (4x6 นิ้ว) สำหรับเครื่องพิมพ์ Flash/Kerry/Xprinter"
                        >
                            ฉลากความร้อน 100x150 mm
                        </button>
                        <button
                            onClick={() => setSelectedDocType('label')}
                            className={`px-2.5 py-1 text-[11px] rounded font-bold uppercase transition-all ${selectedDocType === 'label' ? 'bg-[oklch(52%_0.16_28)] text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                            ใบจ่าหน้าเดี่ยว + รายการแพ็ค
                        </button>
                        <button
                            onClick={() => setSelectedDocType('receipt')}
                            className={`px-2.5 py-1 text-[11px] rounded font-bold uppercase transition-all ${selectedDocType === 'receipt' ? 'bg-[oklch(52%_0.16_28)] text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                            ใบเสร็จรับเงิน
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-1.5 bg-[oklch(52%_0.16_28)] text-white font-bold uppercase hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer"
                    >
                        <span>🖨️</span>
                        <span>[ พิมพ์เอกสาร / PRINT ]</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 border border-[oklch(85%_0.012_28)] text-white uppercase hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        [ ปิด / CLOSE ]
                    </button>
                </div>
            </div>

            {/* Print Styles for Paper Tuning */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: ${selectedDocType === 'thermal_100x150' ? '100mm 150mm' : 'A4 portrait'};
                        margin: ${selectedDocType === 'thermal_100x150' ? '2mm' : '6mm'};
                    }
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    .print-break-inside-avoid {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    .print-page-break-after {
                        page-break-after: always;
                        break-after: page;
                    }
                }
            `}} />

            {/* 1. A4 MULTI-STICKER SHEET MODE (4 Stickers per A4 Sheet: 2x2 Grid) */}
            {selectedDocType === 'a4_stickers' && (
                <div className="w-full max-w-4xl bg-white text-black p-4 sm:p-6 border border-zinc-300 shadow-2xl font-mono text-xs print:m-0 print:p-0 print:border-none print:shadow-none">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {orderList.map((ord, idx) => {
                            const trackingUrl = `${origin}/tracking/${ord.tracking_token || ord.id}`
                            return (
                                <div
                                    key={ord.id || idx}
                                    className="border-2 border-dashed border-zinc-800 p-4 bg-white flex flex-col justify-between gap-3 min-h-[360px] print-break-inside-avoid rounded-sm"
                                >
                                    {/* Top Sticker Header */}
                                    <div className="flex justify-between items-start border-b-2 border-black pb-2">
                                        <div>
                                            <span className="font-bold text-xs uppercase tracking-tight block">
                                                HAUSMADE EXPRESS
                                            </span>
                                            <span className="text-[9px] text-zinc-600 block">
                                                PARCEL DELIVERY STICKER
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-[11px] block text-[oklch(52%_0.16_28)]">
                                                {ord.tracking_token || String(ord.id).slice(-6).toUpperCase()}
                                            </span>
                                            <span className="text-[9px] text-zinc-500">
                                                {new Date(ord.created_at || Date.now()).toLocaleDateString('th-TH')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Sender Block */}
                                    <div className="border border-zinc-300 p-2 bg-zinc-50/70 text-[10px]">
                                        <span className="font-bold uppercase text-zinc-500 block text-[9px] mb-0.5">
                                            ผู้ส่ง (SENDER):
                                        </span>
                                        <div className="font-bold">{senderInfo?.senderName || 'HAUSMADE by IN THE HAUS'}</div>
                                        <div className="text-zinc-600 text-[9px] leading-tight mt-0.5">
                                            {senderInfo?.senderAddress || '430 ถนนสุนทรวิจิตร ตำบลในเมือง อำเภอเมือง จ.นครพนม 48000'}
                                        </div>
                                        <div className="font-bold text-[9px] mt-0.5">โทร: {senderInfo?.senderPhone || '098-528-4217'}</div>
                                    </div>

                                    {/* Recipient Block (High Visual Contrast) */}
                                    <div className="border-2 border-black p-3 bg-white flex-1 flex flex-col justify-between">
                                        <div>
                                            <span className="font-bold uppercase text-black block text-[10px] border-b border-zinc-300 pb-0.5 mb-1">
                                                ผู้รับ (RECIPIENT):
                                            </span>
                                            <div className="font-bold text-sm text-black">
                                                {ord.pickup_contact_name || ord.guest_name || 'ลูกค้า HAUSMADE'}
                                            </div>
                                            <div className="text-xs font-medium text-zinc-900 leading-snug mt-1">
                                                {ord.shipping_address || 'รับหน้าร้าน IN THE HAUS'}
                                            </div>
                                        </div>
                                        <div className="font-bold text-xs mt-2 text-black bg-zinc-100 p-1 rounded inline-block">
                                            โทร: {ord.pickup_contact_phone || ord.phone_number || '-'}
                                        </div>
                                    </div>

                                    {/* Footer: QR Code for Tracking + Items snippet */}
                                    <div className="flex items-center justify-between pt-2 border-t border-zinc-300 gap-2">
                                        <div className="flex-1 text-[9px] text-zinc-600 line-clamp-2">
                                            <span className="font-bold text-black">สินค้า: </span>
                                            {(ord.order_items || []).map(i => `${i.quantity || 1}x ${i.menu_items?.name || i.custom_name || 'สินค้า'}`).join(', ')}
                                        </div>
                                        <div className="shrink-0 flex flex-col items-center">
                                            <QRCodeSVG value={trackingUrl} size={48} level="M" />
                                            <span className="text-[8px] text-zinc-500 font-mono mt-0.5">SCAN TRACK</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* 2. FULL SINGLE SHIPPING LABEL + PACKING CHECKLIST */}
            {selectedDocType === 'label' && (
                <div className="w-full max-w-2xl bg-white text-black p-8 border border-zinc-300 shadow-2xl font-mono text-xs print:m-0 print:p-6 print:border-none print:shadow-none flex flex-col gap-6">
                    {orderList.map((ord, idx) => {
                        const trackingUrl = `${origin}/tracking/${ord.tracking_token || ord.id}`
                        return (
                            <div key={ord.id || idx} className="flex flex-col gap-6 border-2 border-black p-6 print-break-inside-avoid">
                                {/* Header Banner */}
                                <div className="flex justify-between items-start border-b-2 border-black pb-4">
                                    <div>
                                        <span className="font-bold text-sm uppercase block">
                                            HAUSMADE // PARCEL SHIPPING LABEL
                                        </span>
                                        <span className="text-[10px] text-zinc-600 block mt-0.5">
                                            EXPRESS COURIER DELIVERY SERVICE
                                        </span>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <div>
                                            <span className="font-bold text-xs block">
                                                TOKEN: {ord.tracking_token || ord.id}
                                            </span>
                                            <span className="text-[10px] text-zinc-600 block">
                                                DATE: {new Date(ord.created_at || Date.now()).toLocaleDateString('th-TH')}
                                            </span>
                                        </div>
                                        <QRCodeSVG value={trackingUrl} size={46} level="M" />
                                    </div>
                                </div>

                                {/* Sender & Recipient Box */}
                                <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-4">
                                    {/* Sender Details */}
                                    <div className="border border-zinc-400 p-3 bg-zinc-50 flex flex-col gap-1">
                                        <span className="font-bold text-[10px] uppercase text-zinc-500 block border-b border-zinc-300 pb-1 mb-1">
                                            [ SENDER // ผู้ส่ง ]
                                        </span>
                                        <span className="font-bold text-sm">{senderInfo?.senderName || 'HAUSMADE by IN THE HAUS'}</span>
                                        <span className="text-[11px] leading-tight">{senderInfo?.senderAddress}</span>
                                        <span className="font-bold text-xs mt-1">TEL: {senderInfo?.senderPhone}</span>
                                    </div>

                                    {/* Recipient Details */}
                                    <div className="border-2 border-black p-3 bg-white flex flex-col gap-1">
                                        <span className="font-bold text-[10px] uppercase text-black block border-b border-black pb-1 mb-1">
                                            [ RECIPIENT // ผู้รับ ]
                                        </span>
                                        <span className="font-bold text-base">{ord.pickup_contact_name || ord.guest_name || 'ลูกค้า HAUSMADE'}</span>
                                        <span className="text-[12px] font-bold leading-tight mt-0.5">{ord.shipping_address || 'รับหน้าร้าน IN THE HAUS'}</span>
                                        <span className="font-bold text-sm mt-1.5 text-black">TEL: {ord.pickup_contact_phone || ord.phone_number || '-'}</span>
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
                                            {ord.order_items?.map((item, itemIdx) => (
                                                <tr key={itemIdx} className="border-b border-zinc-300">
                                                    <td className="p-2 border-r border-black text-center font-bold">[  ]</td>
                                                    <td className="p-2 border-r border-black">
                                                        <div className="font-bold">{item.menu_items?.name || item.custom_name || 'HAUSMADE ITEM'}</div>
                                                        {item.selected_options && (
                                                            <div className="text-[10px] text-zinc-600">{typeof item.selected_options === 'string' ? item.selected_options : JSON.stringify(item.selected_options)}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-center font-bold">{item.quantity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {ord.customer_note && (
                                    <div className="p-2 bg-zinc-100 border border-zinc-400 text-[11px]">
                                        <span className="font-bold">NOTE: </span> {ord.customer_note}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* 3. OFFICIAL RECEIPT */}
            {selectedDocType === 'receipt' && (
                <div className="w-full max-w-2xl bg-white text-black p-8 border border-zinc-300 shadow-2xl font-mono text-xs print:m-0 print:p-6 print:border-none print:shadow-none flex flex-col gap-6">
                    {orderList.map((ord, idx) => (
                        <div key={ord.id || idx} className="flex flex-col gap-6 border-2 border-black p-6 print-break-inside-avoid">
                            {/* Receipt Header */}
                            <div className="flex justify-between items-start border-b-2 border-black pb-4">
                                <div>
                                    <h1 className="font-bold text-lg uppercase">
                                        {senderInfo?.senderName || 'IN THE HAUS'}
                                    </h1>
                                    <p className="text-[10px] text-zinc-600 leading-tight max-w-xs mt-1">
                                        {senderInfo?.senderAddress}
                                    </p>
                                    <p className="text-[10px] text-zinc-600 mt-1">
                                        TAX ID: {senderInfo?.senderTaxId || '0485566001234'} | TEL: {senderInfo?.senderPhone}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="font-bold text-sm block">RECEIPT / ใบเสร็จรับเงิน</span>
                                    <span className="text-[11px] block mt-1">NO: {ord.tracking_token || ord.id}</span>
                                    <span className="text-[10px] text-zinc-600 block">
                                        DATE: {new Date(ord.created_at || Date.now()).toLocaleDateString('th-TH')}
                                    </span>
                                </div>
                            </div>

                            {/* Customer Info */}
                            <div className="border border-zinc-300 p-3 bg-zinc-50 text-[11px]">
                                <span className="font-bold block mb-1">CUSTOMER:</span>
                                <div>{ord.pickup_contact_name || ord.guest_name || 'ลูกค้าทั่วไป'}</div>
                                <div>{ord.shipping_address || 'รับหน้าร้าน'}</div>
                                <div>TEL: {ord.pickup_contact_phone || ord.phone_number || '-'}</div>
                            </div>

                            {/* Items Table */}
                            <table className="w-full text-left border-collapse border border-black text-[11px]">
                                <thead>
                                    <tr className="bg-zinc-100 border-b border-black">
                                        <th className="p-2 border-r border-black">DESCRIPTION</th>
                                        <th className="p-2 text-center w-12 border-r border-black">QTY</th>
                                        <th className="p-2 text-right w-20 border-r border-black">PRICE</th>
                                        <th className="p-2 text-right w-24">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ord.order_items?.map((item, itemIdx) => (
                                        <tr key={itemIdx} className="border-b border-zinc-300">
                                            <td className="p-2 border-r border-black font-bold">
                                                {item.menu_items?.name || item.custom_name || 'ITEM'}
                                            </td>
                                            <td className="p-2 text-center border-r border-black">{item.quantity}</td>
                                            <td className="p-2 text-right border-r border-black">
                                                ฿{Number(item.price_at_time || 0).toLocaleString()}
                                            </td>
                                            <td className="p-2 text-right font-bold">
                                                ฿{(Number(item.price_at_time || 0) * (item.quantity || 1)).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {ord.shipping_fee > 0 && (
                                        <tr className="border-b border-zinc-300 bg-zinc-50">
                                            <td className="p-2 border-r border-black font-bold">ค่าจัดส่งพัสดุ (Shipping Fee)</td>
                                            <td className="p-2 text-center border-r border-black">1</td>
                                            <td className="p-2 text-right border-r border-black">฿{Number(ord.shipping_fee).toLocaleString()}</td>
                                            <td className="p-2 text-right font-bold">฿{Number(ord.shipping_fee).toLocaleString()}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Grand Total */}
                            <div className="flex justify-end pt-2">
                                <div className="w-64 border border-black p-3 bg-zinc-100 flex flex-col gap-1">
                                    <div className="flex justify-between text-[11px]">
                                        <span>SUBTOTAL:</span>
                                        <span>฿{Number(ord.total_amount || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-sm border-t border-black pt-1">
                                        <span>GRAND TOTAL:</span>
                                        <span>฿{Number(ord.total_amount || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 4. THERMAL DIRECT LABEL 100x150 mm (4x6 inch) FOR LABEL PRINTERS */}
            {selectedDocType === 'thermal_100x150' && (
                <div className="w-full max-w-[105mm] flex flex-col gap-4 font-mono print:max-w-none print:w-full print:gap-0 print:p-0">
                    {orderList.map((ord, idx) => {
                        const trackingUrl = `${origin}/tracking/${ord.tracking_token || ord.id}`
                        const courier = ord.courier_name || 'FLASH EXPRESS'
                        return (
                            <div
                                key={ord.id || idx}
                                className="w-[100mm] min-h-[148mm] bg-white text-black p-3 border-2 border-black flex flex-col justify-between mx-auto print:border-none print:w-full print:h-[148mm] print:min-h-[148mm] print:m-0 print:p-2 print-page-break-after shadow-2xl print:shadow-none"
                            >
                                {/* Header: Courier & Tracking */}
                                <div>
                                    <div className="flex justify-between items-center border-b-2 border-black pb-1.5 mb-2">
                                        <div>
                                            <span className="font-bold text-sm uppercase tracking-tight block">
                                                {courier}
                                            </span>
                                            <span className="text-[8px] text-zinc-600 uppercase block">
                                                HAUSMADE DROP-OFF / PARCEL
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-xs uppercase block text-[oklch(52%_0.16_28)]">
                                                {ord.tracking_token || String(ord.id).slice(-8).toUpperCase()}
                                            </span>
                                            <span className="text-[8px] text-zinc-500">
                                                {new Date(ord.created_at || Date.now()).toLocaleDateString('th-TH')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Sender Info (Compact) */}
                                    <div className="border border-zinc-400 p-1.5 mb-2 bg-zinc-50 text-[9px] leading-tight">
                                        <span className="font-bold text-zinc-500 block">ผู้ส่ง (SENDER):</span>
                                        <span className="font-bold block">{senderInfo?.senderName || 'IN THE HAUS BOUTIQUE'} ({senderInfo?.senderPhone || '098-528-4217'})</span>
                                        <span className="text-zinc-600 block line-clamp-1">{senderInfo?.senderAddress || '199/1 ถ.สุนทรวิจิตร อ.เมือง จ.นครพนม 48000'}</span>
                                    </div>

                                    {/* Recipient Info (Prominent) */}
                                    <div className="border-2 border-black p-2 mb-2 bg-white text-[11px] leading-snug">
                                        <span className="font-bold text-[9px] text-zinc-600 uppercase block">
                                            ผู้รับ (TO / RECIPIENT):
                                        </span>
                                        <div className="flex justify-between items-baseline">
                                            <span className="font-bold text-sm block">
                                                {ord.pickup_contact_name || ord.guest_name || 'คุณลูกค้า'}
                                            </span>
                                            <span className="font-bold text-xs">
                                                {ord.pickup_contact_phone || ord.phone_number || '-'}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-xs text-zinc-800 leading-normal">
                                            {ord.shipping_address || 'ที่อยู่จัดส่งไม่ระบุ'}
                                        </div>
                                    </div>

                                    {/* Items Packing Checklist */}
                                    <div className="border border-black p-1.5 mb-2 text-[9px]">
                                        <span className="font-bold text-[8px] text-zinc-600 uppercase block border-b border-zinc-300 pb-0.5 mb-1">
                                            รายการสินค้าในกล่อง (PACKING CHECKLIST):
                                        </span>
                                        <div className="space-y-0.5">
                                            {ord.order_items?.map((item, itemIdx) => (
                                                <div key={itemIdx} className="flex justify-between items-center">
                                                    <span className="flex items-center gap-1">
                                                        <span>[ ]</span>
                                                        <span className="font-bold">
                                                            {item.menu_items?.name || item.custom_name || 'ITEM'}
                                                        </span>
                                                    </span>
                                                    <span className="font-bold text-xs">
                                                        x{item.quantity}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer with QR Code & Barcode space */}
                                <div className="border-t-2 border-black pt-2 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <QRCodeSVG
                                            value={trackingUrl}
                                            size={48}
                                            level="M"
                                            includeMargin={false}
                                        />
                                        <div className="text-[8px] leading-tight">
                                            <span className="font-bold block">SCAN TRACKING</span>
                                            <span className="text-zinc-600 block">สแกนตรวจสอบสถานะ</span>
                                            <span className="text-[7px] text-zinc-400 block font-mono">
                                                #{ord.tracking_token || String(ord.id).slice(-6)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right text-[8px]">
                                        <span className="block font-bold">THANK YOU FOR YOUR ORDER</span>
                                        <span className="text-zinc-500 block">inthehaus.cafe/shop</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
