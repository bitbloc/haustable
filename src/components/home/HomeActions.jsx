import { Link, useNavigate } from 'react-router-dom'
import { Calendar, ShoppingBag, ChefHat, Music, ArrowRight, Lock } from 'lucide-react'

export default function HomeActions({ settings, checkStatus, t, user, setShowAuthModal }) {
    const navigate = useNavigate();
    
    if (!settings) return null; // Wait for settings

    const tableStatus = checkStatus(settings, 'shop_mode_table');
    const pickupStatus = checkStatus(settings, 'shop_mode_pickup');
    
    // Steak preorders are open if shop is open generally, or manual open
    const steakStatus = checkStatus(settings, 'shop_mode_table'); 

    const actions = [
        {
            id: 'table',
            num: '01',
            label: 'จองโต๊ะอาหาร',
            labelEn: 'Table Booking',
            path: '/booking',
            statusText: tableStatus.isOpen ? 'เปิดจองออฟไลน์/ออนไลน์' : 'ปิดให้บริการชั่วคราว',
            isOpen: tableStatus.isOpen,
            icon: <Calendar size={18} />,
            accentColor: 'var(--color-brand)'
        },
        {
            id: 'pickup',
            num: '02',
            label: 'สั่งอาหารกลับบ้าน',
            labelEn: 'Order Pickup',
            path: '/pickup',
            statusText: pickupStatus.isOpen ? 'สั่งล่วงหน้ารับหน้าร้าน' : 'บริการปิดชั่วคราว',
            isOpen: pickupStatus.isOpen,
            icon: <ShoppingBag size={18} />,
            accentColor: 'var(--color-brand)'
        },
        {
            id: 'steak',
            num: '03',
            label: 'พรีออเดอร์สเต็ก',
            labelEn: 'Steak Pre-order',
            path: '/steak-preorder',
            statusText: 'พรีออเดอร์เนื้อดรายเอจพิเศษ',
            isOpen: true, // Custom dry-aged booking usually accepts requests
            icon: <ChefHat size={18} />,
            accentColor: 'var(--color-brand)'
        },
        {
            id: 'spotify',
            num: '04',
            label: 'ขอเพลง 100 บาท',
            labelEn: 'Spotify Queue Request',
            path: '/songs',
            statusText: 'ส่งเพลงเข้าลำโพงร้าน',
            isOpen: true,
            icon: <Music size={18} />,
            accentColor: 'var(--color-brand)'
        }
    ];

    const handleActionClick = (e, action) => {
        if (!user) {
            e.preventDefault();
            setShowAuthModal(true);
            return;
        }
        if (!action.isOpen) {
            e.preventDefault();
        }
    };

    return (
        <div className="w-full flex flex-col gap-3 font-[var(--font-body)]">
            <div className="flex items-center justify-between w-full border-b border-[var(--color-hallmark-rule)] pb-2 mb-1">
                <span className="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink-muted)] uppercase tracking-wider">
                    [ CONTROL PANEL // SERVICES ]
                </span>
                <span className="font-mono text-[10px] text-[var(--color-hallmark-ink-muted)]">
                    SELECT DIAL TO ENGAGE
                </span>
            </div>

            <div className="flex flex-col gap-3 w-full">
                {actions.map((act) => {
                    const buttonContent = (
                        <div className="flex items-center justify-between w-full p-4">
                            <div className="flex items-center gap-4">
                                {/* Braun Dial Indicator knob */}
                                <div className="relative flex items-center justify-center w-9 h-9 rounded-full border border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)] flex-shrink-0 transition-transform group-hover:scale-105">
                                    <div className="w-3 h-3 rounded-full" style={{
                                        backgroundColor: act.isOpen ? 'var(--color-brand)' : 'oklch(60% 0.005 70)',
                                        boxShadow: act.isOpen ? '0 0 8px var(--color-brand)' : 'none'
                                    }} />
                                    {/* Small dial indicator mark */}
                                    <div className="absolute top-1 w-0.5 h-1.5 bg-[var(--color-hallmark-ink-muted)] rounded-full transform origin-bottom" style={{
                                        transform: act.isOpen ? 'rotate(45deg)' : 'rotate(0deg)'
                                    }} />
                                </div>

                                <div className="flex flex-col text-left">
                                    <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--color-hallmark-ink-muted)] uppercase">
                                        {act.num} / {act.labelEn}
                                    </span>
                                    <span className="font-bold text-[16px] text-[var(--color-hallmark-ink)] leading-tight mt-1">
                                        {act.label}
                                    </span>
                                    <span className="text-[12px] text-[var(--color-hallmark-ink-muted)] leading-none mt-1.5">
                                        {act.statusText}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {!user ? (
                                    <div className="p-2 border border-dashed border-[var(--color-hallmark-rule)] rounded-sm text-[var(--color-hallmark-ink-muted)]">
                                        <Lock size={14} />
                                    </div>
                                ) : act.isOpen ? (
                                    <ArrowRight size={16} className="text-[var(--color-hallmark-ink-muted)] group-hover:translate-x-1 transition-transform" />
                                ) : (
                                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-sm">
                                        OFFLINE
                                    </span>
                                )}
                            </div>
                        </div>
                    );

                    return (
                        <Link
                            key={act.id}
                            to={act.isOpen ? act.path : '#'}
                            onClick={(e) => handleActionClick(e, act)}
                            className={`group w-full flex flex-col justify-center rounded-lg border bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] transition-all duration-200 border-[var(--color-hallmark-rule)] shadow-sm focus-visible:outline-2 focus-visible:outline-[var(--color-brand)] ${
                                !act.isOpen ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                        >
                            {buttonContent}
                        </Link>
                    );
                })}
            </div>
        </div>
    )
}
