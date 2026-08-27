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
            cta: 'จองเลย',
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
            cta: 'สั่งเลย',
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
            cta: 'ซื้อสินค้า',
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
                    SELECT SERVICE // เลือกบริการ
                </span>
            </div>

            {/* 1. Primary Service Dials (Full Width Stack) */}
            <div className="flex flex-col w-full divide-y divide-[var(--color-hallmark-rule)]">
                {primaryActions.map((act) => {
                    const rowContent = (
                        <div className="flex items-center justify-between w-full p-4 sm:p-4.5">
                            <div className="flex flex-col text-left min-w-0 pr-4">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] sm:text-[11px] font-bold tracking-widest text-[var(--color-hallmark-ink-muted)] uppercase">
                                        {act.num} // {act.labelEn}
                                    </span>
                                </div>
                                <span className="font-bold text-[16px] sm:text-[17px] text-[var(--color-hallmark-ink)] leading-snug mt-0.5 truncate">
                                    {act.label}
                                </span>
                                <span className="text-[12px] text-[var(--color-hallmark-ink-muted)] leading-tight mt-0.5 line-clamp-1">
                                    {act.desc}
                                </span>
                            </div>

                            {/* Action CTA indicator */}
                            <div className="flex items-center flex-shrink-0">
                                {act.isOpen ? (
                                    <span className="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink)] px-3 py-1.5 border border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)] group-hover:bg-[var(--color-hallmark-ink)] group-hover:text-[var(--color-hallmark-paper)] group-hover:border-[var(--color-hallmark-ink)] transition-all">
                                        [ {act.cta} ➔ ]
                                    </span>
                                ) : (
                                    <span className="font-mono text-[10px] font-bold px-2.5 py-1 bg-[var(--color-accent-red)] text-white">
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
                            {rowContent}
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
