/* Hallmark · component: HausmadeShippingTracker · theme: Atelier (Thai Modern OKLCH)
 * features: Multi-Courier Tracking Link, 1-Click Copy Tracking Number, Delivery Timeline, Destination Card
 */
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

export default function HausmadeShippingTracker({ data, settings = {} }) {
    const [copied, setCopied] = useState(false)

    if (!data) return null

    const trackingNumber = data.tracking_number || ''
    const courierName = data.courier_name || 'Flash Express'
    const status = (data.status || 'pending').toLowerCase()
    const isCancelled = status === 'cancelled'

    // Direct Tracking Links for Thai Couriers
    const getDirectCourierUrl = (courier, code) => {
        if (!code) return null
        const cleanCode = encodeURIComponent(code.trim())
        const cLower = (courier || '').toLowerCase()

        if (cLower.includes('flash')) {
            return `https://www.flashexpress.co.th/tracking/?se=${cleanCode}`
        }
        if (cLower.includes('ไปรษณีย์') || cLower.includes('ems') || cLower.includes('thailand post')) {
            return `https://track.thailandpost.co.th/?trackNumber=${cleanCode}`
        }
        if (cLower.includes('kerry') || cLower.includes('kex')) {
            return `https://th.kerryexpress.com/th/track/?track=${cleanCode}`
        }
        if (cLower.includes('j&t') || cLower.includes('jt')) {
            return `https://www.jtexpress.co.th/service/track?bills=${cleanCode}`
        }
        if (cLower.includes('spx') || cLower.includes('shopee')) {
            return `https://spx.co.th/m/track?tracking_number=${cleanCode}`
        }
        return null
    }

    const courierUrl = getDirectCourierUrl(courierName, trackingNumber)

    const handleCopyTracking = () => {
        if (!trackingNumber) return
        navigator.clipboard.writeText(trackingNumber)
        setCopied(true)
        toast.success(`คัดลอกเลขพัสดุ ${trackingNumber} แล้ว!`)
        setTimeout(() => setCopied(false), 2500)
    }

    // Shipping Stages
    const stages = [
        { key: 'pending', title: 'รอตรวจสอบชำระเงิน', desc: 'ระบบกำลังตรวจสอบสลิป', step: 1 },
        { key: 'confirmed', title: 'ยืนยันคำสั่งซื้อแล้ว', desc: 'ได้รับยอดเงินเรียบร้อย', step: 2 },
        { key: 'packing', title: 'กำลังแพ็คพัสดุ', desc: 'ทีมงานกำลังจัดเตรียมสินค้า', step: 3 },
        { key: 'shipped', title: 'ขนส่งรับพัสดุแล้ว', desc: 'พัสดุกำลังเดินทางนำจ่าย', step: 4 },
        { key: 'completed', title: 'จัดส่งสำเร็จ', desc: 'พัสดุถึงมือผู้รับเรียบร้อย', step: 5 }
    ]

    const getActiveStepIndex = () => {
        if (isCancelled) return -1
        if (status === 'completed' || status === 'delivered') return 4
        if (status === 'shipped') return 3
        if (status === 'packing') return 2
        if (status === 'confirmed') return 1
        return 0 // pending
    }

    const currentStepIdx = getActiveStepIndex()

    return (
        <div className="w-full flex flex-col gap-6 font-sans select-none">
            
            {/* 1. Courier & Tracking Hero Card */}
            <div className="bg-[oklch(97%_0.008_28)] border-2 border-[oklch(18%_0.012_28)] p-5 sm:p-6 shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-start border-b border-[oklch(85%_0.012_28)] pb-3">
                    <div>
                        <span className="font-mono text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-widest block">
                            // PARCEL DELIVERY TRACKING
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                            {courierName}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {(data.is_preorder || (data.customer_note && data.customer_note.includes('PRE-ORDER'))) && (
                            <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-[oklch(45%_0.08_140)] text-white">
                                ⏳ PRE-ORDER
                            </span>
                        )}
                        <span className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase border ${
                            status === 'shipped' || status === 'completed'
                                ? 'bg-[oklch(45%_0.08_140)]/15 text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]'
                                : 'bg-[oklch(52%_0.16_28)]/15 text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)]'
                        }`}>
                            {status === 'shipped' ? '🚚 กำลังจัดส่ง' : status === 'completed' ? '✓ จัดส่งสำเร็จ' : `[ ${status.toUpperCase()} ]`}
                        </span>
                    </div>
                </div>

                {/* Tracking Number Display Box */}
                <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div>
                        <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase block">
                            เลขพัสดุ (TRACKING NUMBER)
                        </span>
                        {trackingNumber ? (
                            <span className="font-mono text-lg sm:text-xl font-bold text-[oklch(18%_0.012_28)] tracking-wider block mt-0.5 select-all">
                                {trackingNumber}
                            </span>
                        ) : (
                            <span className="font-mono text-sm text-[oklch(55%_0.010_28)] italic block mt-0.5">
                                [ กำลังจัดเตรียมเลขพัสดุจากขนส่ง ]
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {trackingNumber && (
                            <button
                                onClick={handleCopyTracking}
                                className="px-3.5 py-2 bg-white hover:bg-[oklch(18%_0.012_28)] text-[oklch(18%_0.012_28)] hover:text-white font-mono text-xs font-bold uppercase border border-[oklch(85%_0.012_28)] transition-colors cursor-pointer shadow-2xs"
                            >
                                {copied ? '[ ✓ COPIED ]' : '[ 📋 คัดลอกเลข ]'}
                            </button>
                        )}

                        {courierUrl && (
                            <a
                                href={courierUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)] font-mono text-xs font-bold uppercase transition-colors flex items-center gap-1.5 shadow-2xs"
                            >
                                <span>เช็คสถานะกับ {courierName.split(' ')[0]} ➔</span>
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Timeline Progression */}
            <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-5 sm:p-6 flex flex-col gap-4">
                <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                    [ FULFILLMENT TIMELINE // ขั้นตอนการจัดส่ง ]
                </span>

                <div className="relative flex flex-col gap-6 pl-3 border-l-2 border-[oklch(85%_0.012_28)] ml-2 my-2">
                    {stages.map((st, idx) => {
                        const isPast = idx < currentStepIdx
                        const isCurrent = idx === currentStepIdx
                        const isUpcoming = idx > currentStepIdx

                        return (
                            <div key={st.key} className="relative flex items-start gap-3">
                                {/* Dot Indicator */}
                                <div className={`absolute -left-[19px] top-0.5 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                                    isCurrent
                                        ? 'bg-[oklch(52%_0.16_28)] border-white ring-2 ring-[oklch(52%_0.16_28)] animate-pulse'
                                        : isPast
                                            ? 'bg-[oklch(18%_0.012_28)] border-[oklch(18%_0.012_28)]'
                                            : 'bg-white border-[oklch(85%_0.012_28)]'
                                }`} />

                                <div className="flex flex-col">
                                    <span className={`text-xs font-bold ${
                                        isCurrent
                                            ? 'text-[oklch(52%_0.16_28)] font-bold text-sm'
                                            : isPast
                                                ? 'text-[oklch(18%_0.012_28)]'
                                                : 'text-[oklch(55%_0.010_28)]'
                                    }`}>
                                        {st.title} {isCurrent && '(สถานะปัจจุบัน)'}
                                    </span>
                                    <span className="text-[11px] text-[oklch(42%_0.010_28)] mt-0.5">
                                        {st.desc}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* 3. Destination & Package Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                {/* Destination Address */}
                <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                        [ DESTINATION ADDRESS // ที่อยู่จัดส่ง ]
                    </span>
                    <span className="font-bold text-sm text-[oklch(18%_0.012_28)]">
                        {data.pickup_contact_name || data.guest_name || 'ลูกค้า HAUSMADE'}
                    </span>
                    <span className="text-[11px] text-[oklch(42%_0.010_28)]">
                        TEL: {data.pickup_contact_phone || data.phone_number || '-'}
                    </span>
                    <span className="text-[11px] leading-relaxed text-[oklch(18%_0.012_28)] font-sans font-medium mt-1">
                        {data.shipping_address || 'รับหน้าร้าน IN THE HAUS (นครพนม)'}
                    </span>
                </div>

                {/* Sender & Dispatch Info */}
                <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                        [ DISPATCHED FROM // ส่งตรงจาก ]
                    </span>
                    <span className="font-bold text-sm text-[oklch(18%_0.012_28)]">
                        HAUSMADE BY IN THE HAUS
                    </span>
                    <span className="text-[11px] text-[oklch(42%_0.010_28)]">
                        ริมแม่น้ำโขง อำเภอเมือง จังหวัดนครพนม 48000
                    </span>
                    <span className="text-[10px] text-[oklch(52%_0.16_28)] font-bold mt-1">
                        TEL: 098-528-4217 | LINE: @inthehaus
                    </span>
                </div>
            </div>
        </div>
    )
}
