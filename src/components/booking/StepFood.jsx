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
        isCheckoutMode,
        isOptionModalOpen, selectedItemForOptions,
        closeOptionModal, confirmOptionSelection
    } = useBooking()

    return (
        <div className="h-full flex flex-col">
            <BookingHeader
                title={isCheckoutMode ? t('confirmBooking') : t('foodAndDetail')}
                subtitle={t('stepFood')}
            />

            {!isCheckoutMode ? <BookingMenu /> : <BookingCheckout />}

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
