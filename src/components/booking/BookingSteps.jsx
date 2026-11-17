import React, { Suspense, lazy, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useBooking } from '../../hooks/useBooking'
import StepDateSelection from './StepDateSelection'
import RetryState from '../shared/RetryState'
import { getEntryBackPath, rememberEntry, trackFunnel, trackFunnelPageView } from '../../utils/funnelTracking'

// Step 1 ships with the page; the floor plan and the food / checkout steps load when needed.
const loadTableStep = () => import('./StepTableSelection')
const loadFoodStep = () => import('./StepFood')
const StepTableSelection = lazy(loadTableStep)
const StepFood = lazy(loadFoodStep)
const prefetchTableStep = () => { loadTableStep().catch(() => {}) }

const StepLoading = () => (
    <div className="min-h-[60vh] flex items-center justify-center text-subInk text-base" aria-busy="true">
        กำลังโหลด...
    </div>
)

export default function BookingSteps() {
    const navigate = useNavigate()
    const {
        step, direction, prevStep,
        isCheckoutMode, setCheckoutMode, loadError, settings,
        bookingMode, setBookingMode, isFreeBooking,
        retryBookingData, setLiveScope
    } = useBooking()

    // Page view first, then the step events below (effects run in this order)
    useEffect(() => {
        rememberEntry()
        trackFunnelPageView('booking')
    }, [])

    // Realtime follows the open step (step 3 sets 'menu' itself while the menu is open)
    useEffect(() => {
        if (step === 1) setLiveScope('date')
        else if (step === 2) setLiveScope('table')
        else setLiveScope(null)
        return () => setLiveScope(null)
    }, [step, setLiveScope])

    // A new step starts at its top, not at the scroll position of the last one
    useEffect(() => {
        if (direction !== 0) window.scrollTo(0, 0)
    }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

    // Funnel: steps 1-2 here, step 3 (mode / menu / checkout) in StepFood
    useEffect(() => {
        if (step === 1) trackFunnel('booking_step_date')
        else if (step === 2) trackFunnel('booking_step_table')
    }, [step])

    // While on the date step, warm the floor-plan chunk so step 2 opens at once
    useEffect(() => {
        if (step !== 1) return
        const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500))
        const id = idle(() => { prefetchTableStep(); loadFoodStep().catch(() => {}) })
        return () => (window.cancelIdleCallback || clearTimeout)(id)
    }, [step])

    // No slide on the first paint (direction is 0 until the step changes)
    const enterClass = direction === 0 ? '' : (direction < 0 ? 'step-enter-back' : 'step-enter-fwd')

    if (loadError) {
        return <RetryState title="โหลดข้อมูลการจองไม่สำเร็จ" message={loadError} onRetry={retryBookingData} />
    }

    const handleBack = () => {
        // Step 3 back: prepaid checkout -> menu -> booking-type choice -> table step
        if (step === 3 && isCheckoutMode && !isFreeBooking) {
            setCheckoutMode(false)
            return
        }
        if (step === 3 && bookingMode && !settings.bookingDepositRequired) {
            setBookingMode(null)
            return
        }
        if (step === 1) {
            const back = getEntryBackPath()
            // /link is api/link.js, not a React route
            if (back === '/link') window.location.assign('/link')
            else navigate('/')
        } else prevStep()
    }

    return (
        <div className="min-h-screen bg-canvas flex flex-col p-6 font-sans text-ink">
            {/* Top Nav */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--color-rule)]">
                <button
                    type="button"
                    onClick={handleBack}
                    aria-label="ย้อนกลับ"
                    className="w-12 h-12 flex items-center justify-center hover:bg-paper rounded-rams transition-colors border border-[var(--color-rule)]"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex gap-1" aria-label={`ขั้นตอน ${step} จาก 3`}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`h-1 w-8 transition-colors duration-150 ${i <= step ? 'bg-ink' : 'bg-[var(--color-rule)]'}`} />
                    ))}
                </div>
            </div>

            <div className={`flex-1 mx-auto w-full relative ${step === 2 ? 'max-w-lg md:max-w-4xl' : 'max-w-lg'}`}>
                <div key={step} className={`h-full flex flex-col ${step === 2 ? 'relative' : ''} ${enterClass}`}>
                    {step === 1 && <StepDateSelection />}
                    {step === 2 && (
                        <Suspense fallback={<StepLoading />}>
                            <StepTableSelection />
                        </Suspense>
                    )}
                    {step === 3 && (
                        <Suspense fallback={<StepLoading />}>
                            <StepFood />
                        </Suspense>
                    )}
                </div>
            </div>
        </div>
    )
}
