/* Hallmark · component: HomeActions · genre: modern-minimal · theme: dieter-rams-thai-modern
 * states: default · hover · active · disabled
 * contrast: pass (APCA / WCAG AAA compliant)
 */
import React from 'react'
import { Link } from 'react-router-dom'

export default function HomeActions({ settings, checkStatus, t, user, profile, setShowAuthModal }) {
    if (!settings) return null

    const tableStatus = checkStatus(settings, 'shop_mode_table')
    const pickupStatus = checkStatus(settings, 'shop_mode_pickup')
    const hausmadeStatus = checkStatus(settings, 'shop_mode_hausmade')

    const primaryActions = [
        {
            id: 'table',
            num: '01',
            label: 'จองโต๊ะอาหาร',
            labelEn: 'Table Booking',
            desc: 'จองโต๊ะล่วงหน้า เลือกลาน/โซน มัดจำหักเป็นเครดิต 100%',
            path: '/booking',
            statusText: tableStatus.isOpen ? 'เปิดรับจองโต๊ะออนไลน์' : 'ปิดรับจองชั่วคราว',
            isOpen: tableStatus.isOpen,
            accent: 'var(--color-brand)'
        },
        {
            id: 'pickup',
            num: '02',
            label: 'สั่งอาหารกลับบ้าน',
            labelEn: 'Order Pickup',
            desc: 'สั่งล่วงหน้า เลือกเวลารับ จัดเตรียมสดใหม่พร้อมรับหน้าร้าน',
            path: '/pickup',
            statusText: pickupStatus.isOpen ? 'สั่งล่วงหน้ารับหน้าร้าน' : 'บริการปิดชั่วคราว',
            isOpen: pickupStatus.isOpen,
            accent: 'var(--color-brand)'
        },
        {
            id: 'hausmade',
            num: '03',
            label: 'HAUSMADE Shop',
            labelEn: 'Craft & Retail Store',
            desc: 'เครื่องแกง น้ำพริก สินค้าพรีเมียม สั่งจัดส่งทั่วประเทศ',
            path: '/hausmade',
            statusText: hausmadeStatus.isOpen ? 'ช้อปออนไลน์ จัดส่งทั่วไทย' : 'บริการปิดชั่วคราว',
            isOpen: hausmadeStatus.isOpen,
            accent: 'oklch(52% 0.16 28)'
        }
    ]

    const secondaryHub = [
        {
            id: 'member',
            tag: 'REWARDS',
            title: 'บัตรสมาชิก',
            titleEn: 'Member Card',
            path: '/member-card',
            badge: user ? `${Number(profile?.xhaus_balance || 0)} XHAUS` : 'JOIN VIP',
            isOpen: true
        },
        {
            id: 'checkin',
            tag: 'VIBES',
            title: 'บรรยากาศร้าน',
            titleEn: 'Guest Stream',
            path: '/link/hauscheckin',
            badge: 'STREAM',
            isOpen: true
        },
        {
            id: 'qa',
            tag: 'DETAILS',
            title: 'คำถามที่พบบ่อย',
            titleEn: 'House Q&A',
            path: '/qa',
            badge: 'INFO',
            isOpen: true
        }
    ]

    return (
        <div className="w-full flex flex-col font-[var(--font-body)] select-none">
            
            {/* Control Panel Section Header */}
            <div className="flex items-center justify-between w-full p-4 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                <span className="font-mono text-[11px] font-black text-[var(--color-hallmark-ink)] uppercase tracking-wider">
                    [ CONTROL PANEL // SERVICES ]
                </span>
                <span className="font-mono text-[10px] text-[var(--color-hallmark-ink-muted)]">
                    SELECT SERVICE TO ENGAGE
                </span>
            </div>

            {/* 1. Primary Service Dials (Full Width Stack) */}
            <div className="flex flex-col w-full divide-y divide-[var(--color-hallmark-rule)]">
                {primaryActions.map((act) => {
                    const dialContent = (
                        <div className="flex items-center justify-between w-full p-4">
                            <div className="flex items-center gap-3.5 sm:gap-4 flex-grow min-w-0 pr-3">
                                {/* Dieter Rams Precision Rotary Dial */}
                                <div className="relative flex items-center justify-center w-10 h-10 border border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)] flex-shrink-0 transition-transform group-hover:scale-105">
                                    <div 
                                        className="w-3.5 h-3.5 rounded-full transition-all duration-300"
                                        style={{
                                            backgroundColor: act.isOpen ? 'oklch(64% 0.22 140)' : 'oklch(60% 0.005 70)',
                                            boxShadow: act.isOpen ? '0 0 10px rgba(16,185,129,0.7)' : 'none'
                                        }} 
                                    />
                                    {/* Dial rotary marker notch */}
                                    <div 
                                        className="absolute top-1 w-0.5 h-2 bg-[var(--color-hallmark-ink-muted)] transform origin-bottom transition-transform duration-300" 
                                        style={{
                                            transform: act.isOpen ? 'rotate(45deg)' : 'rotate(0deg)'
                                        }} 
                                    />
                                </div>

                                <div className="flex flex-col text-left min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--color-hallmark-ink-muted)] uppercase">
                                            {act.num} // {act.labelEn}
                                        </span>
                                    </div>
                                    <span className="font-bold text-[15px] sm:text-[16px] text-[var(--color-hallmark-ink)] leading-snug mt-0.5 truncate">
                                        {act.label}
                                    </span>
                                    <span className="text-[11px] text-[var(--color-hallmark-ink-muted)] leading-tight mt-0.5 line-clamp-1">
                                        {act.desc}
                                    </span>
                                </div>
                            </div>

                            {/* Action CTA indicator */}
                            <div className="flex items-center flex-shrink-0">
                                {act.isOpen ? (
                                    <span className="font-mono text-[11px] font-black text-[var(--color-hallmark-ink)] px-2.5 py-1 border border-[var(--color-hallmark-rule)] group-hover:bg-[var(--color-hallmark-ink)] group-hover:text-[var(--color-hallmark-paper)] transition-all">
                                        [ ENGAGE ➔ ]
                                    </span>
                                ) : (
                                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-[var(--color-accent-red)] text-white">
                                        OFFLINE
                                    </span>
                                )}
                            </div>
                        </div>
                    )

                    return (
                        <Link
                            key={act.id}
                            to={act.isOpen ? act.path : '#'}
                            onClick={(e) => {
                                if (!act.isOpen) e.preventDefault()
                            }}
                            className={`group w-full flex flex-col justify-center bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] transition-colors ${
                                !act.isOpen ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                        >
                            {dialContent}
                        </Link>
                    )
                })}
            </div>

            {/* 2. Secondary Interactive Hub Header */}
            <div className="flex items-center justify-between w-full p-3 border-y border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                <span className="font-mono text-[10px] font-bold text-[var(--color-hallmark-ink-muted)] uppercase tracking-wider">
                    [ QUICK ACCESS // EXPERIENCES ]
                </span>
                <span className="font-mono text-[9px] text-[var(--color-hallmark-ink-muted)]">
                    3 MODULES
                </span>
            </div>

            {/* 3-Column Tabular Cellular Hub */}
            <div className="grid grid-cols-3 divide-x divide-[var(--color-hallmark-rule)] border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)]">
                {secondaryHub.map((item) => (
                    <Link
                        key={item.id}
                        to={item.path}
                        className="group p-3 sm:p-3.5 flex flex-col justify-between h-full min-h-[86px] bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] transition-colors cursor-pointer"
                    >
                        <div className="flex items-center justify-between w-full gap-1">
                            <span className="font-mono text-[8.5px] sm:text-[9px] font-bold text-[var(--color-hallmark-ink-muted)] uppercase tracking-wider truncate">
                                {item.tag}
                            </span>
                            <span className="font-mono text-[8px] sm:text-[8.5px] font-extrabold px-1 py-0.2 border border-[var(--color-hallmark-ink)] text-[var(--color-hallmark-ink)] bg-[var(--color-hallmark-paper)] flex-shrink-0">
                                {item.badge}
                            </span>
                        </div>

                        <div className="flex flex-col mt-2">
                            <span className="font-bold text-[12px] sm:text-[13px] text-[var(--color-hallmark-ink)] leading-tight truncate">
                                {item.title}
                            </span>
                            <span className="font-mono text-[9px] sm:text-[9.5px] text-[var(--color-hallmark-ink-muted)] leading-none mt-0.5 truncate">
                                {item.titleEn}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>

        </div>
    )
}
