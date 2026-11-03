import React from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { useBooking } from '../../hooks/useBooking'
import BookingHeader from './BookingHeader'
import BookingMenu from './BookingMenu'
import BookingCheckout from './BookingCheckout'
import OptionSelectionModal from '../shared/OptionSelectionModal'

export default function StepFood() {
    const { t } = useLanguage()
    const {
        isCheckoutMode, settings,
        isOptionModalOpen, selectedItemForOptions,
        closeOptionModal, confirmOptionSelection
    } = useBooking()

    // Free bookings are table-only (staff confirm by phone, food is ordered at the table),
    // so the menu is skipped and step 3 is just the confirm page.
    const showCheckout = isCheckoutMode || !settings.bookingDepositRequired

    return (
        <div className="h-full flex flex-col">
            <BookingHeader
                title={showCheckout ? t('confirmBooking') : t('foodAndDetail')}
                subtitle={t('stepFood')}
            />

            {!showCheckout ? <BookingMenu /> : <BookingCheckout />}

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
