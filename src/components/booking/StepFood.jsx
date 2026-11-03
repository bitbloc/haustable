import React from 'react'
import { ArrowRight } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBooking } from '../../hooks/useBooking'
import BookingHeader from './BookingHeader'
import BookingMenu from './BookingMenu'
import BookingCheckout from './BookingCheckout'
import OptionSelectionModal from '../shared/OptionSelectionModal'

// Two ways to book: a free table-only booking (staff call to confirm, food ordered at the table),
// or the prepaid path (pre-order food, pay online). Shops that require a deposit skip the choice.
function BookingModeChoice({ onChoose, holdMinutes, pax }) {
    const options = [
        {
            mode: 'free',
            tag: 'จองฟรี',
            title: 'จองโต๊ะอย่างเดียว',
            lines: [
                'ไม่มีค่าใช้จ่าย สั่งอาหารที่ร้าน',
                'ร้านจะโทรยืนยันการจองก่อนทุก⁠ครั้ง',
                `เก็บโต๊ะให้ ${holdMinutes} นาทีหลังเวลาจอง`
            ]
        },
        {
            mode: 'prepaid',
            tag: 'สั่งล่วงหน้า',
            title: 'เลือกอาหารล่วงหน้า + ชำระผ่าน⁠ระบบ',
            lines: [
                'ครัวเตรียมอาหารไว้ให้ตามเวลา',
                'ชำระล่วงหน้า 50% หรือเต็มจำนวน',
                `สั่งขั้นต่ำ ฿150 ต่อท่าน (${pax} ท่าน = ฿${150 * pax})`
            ]
        }
    ]

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-subInk">เลือกรูปแบบการจอง</p>
            <div className="flex flex-col border border-[var(--color-rule)] bg-paper rounded-rams divide-y divide-[var(--color-rule)] overflow-hidden">
                {options.map((opt) => (
                    <button
                        key={opt.mode}
                        type="button"
                        onClick={() => onChoose(opt.mode)}
                        className="group text-left p-4 flex items-center justify-between gap-4 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink transition-colors cursor-pointer"
                    >
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-subInk">{opt.tag}</span>
                            <span className="text-base font-bold text-ink leading-snug">{opt.title}</span>
                            <ul className="text-sm text-subInk leading-relaxed">
                                {opt.lines.map((l) => <li key={l}>{l}</li>)}
                            </ul>
                        </div>
                        <span className="shrink-0 w-10 h-10 border border-[var(--color-rule)] flex items-center justify-center text-ink group-hover:bg-ink group-hover:text-paper group-hover:border-ink transition-colors">
                            <ArrowRight size={16} />
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}

export default function StepFood() {
    const { t } = useLanguage()
    const {
        isCheckoutMode, settings, pax,
        bookingMode, setBookingMode, isFreeBooking,
        isOptionModalOpen, selectedItemForOptions,
        closeOptionModal, confirmOptionSelection
    } = useBooking()

    const offersChoice = !settings.bookingDepositRequired
    const view = offersChoice && !bookingMode
        ? 'choice'
        : (isFreeBooking || isCheckoutMode ? 'checkout' : 'menu')

    return (
        <div className="h-full flex flex-col">
            <BookingHeader
                title={view === 'choice' ? t('reservation') : view === 'checkout' ? t('confirmBooking') : t('foodAndDetail')}
                subtitle={t('stepFood')}
            />

            {view === 'choice' && (
                <BookingModeChoice
                    onChoose={setBookingMode}
                    holdMinutes={settings.bookingHoldMinutes || 30}
                    pax={pax}
                />
            )}
            {view === 'menu' && <BookingMenu />}
            {view === 'checkout' && <BookingCheckout />}

            {/* Option Modal */}
            {isOptionModalOpen && selectedItemForOptions && (
                <OptionSelectionModal
                    item={selectedItemForOptions}
                    onClose={closeOptionModal}
                    onConfirm={confirmOptionSelection}
                />
            )}
        </div>
    )
}
