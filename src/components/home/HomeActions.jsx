import { Link, useNavigate } from 'react-router-dom'

export default function HomeActions({ settings, checkStatus, t, user, setShowAuthModal }) {
    const navigate = useNavigate();
    
    if (!settings) return null; // Wait for settings

    const tableStatus = checkStatus(settings, 'shop_mode_table');
    const pickupStatus = checkStatus(settings, 'shop_mode_pickup');
    

    const actions = [
        {
            id: 'table',
            num: '01',
            label: 'จองโต๊ะอาหาร',
            labelEn: 'Table Booking',
            path: '/booking',
            statusText: tableStatus.isOpen ? 'เปิดจองออฟไลน์/ออนไลน์' : 'ปิดให้บริการชั่วคราว',
            isOpen: tableStatus.isOpen,
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
                                    <span className="font-mono text-[10px] font-bold text-[var(--color-hallmark-ink-muted)] border border-dashed border-[var(--color-hallmark-rule)] px-2 py-1">
                                        [ LOCKED ]
                                    </span>
                                ) : act.isOpen ? (
                                    <span className="font-mono text-[10px] font-bold text-[var(--color-hallmark-ink)] group-hover:translate-x-1 transition-transform inline-block">
                                        [ ENGAGE ]
                                    </span>
                                ) : (
                                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-[var(--color-accent-red)] text-white rounded-none">
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
                            className={`group w-full flex flex-col justify-center rounded-none border-b border-[var(--color-hallmark-rule)] last:border-b-0 bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[var(--color-brand)] ${
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
