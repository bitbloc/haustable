import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSteakBooking } from '../../hooks/useSteakBooking'
import StepDateSelector from './StepDateSelector'
import SteakStepTableSelection from './SteakStepTableSelection'
import StepSteakSelection from './StepSteakSelection'
import StepPreferences from './StepPreferences'
import StepReviewOrder from './StepReviewOrder'

// Visual config
const STEPS = [
    { id: 1, title: 'จองโต๊ะ (Reservation)' },
    { id: 2, title: 'เลือกโต๊ะ (Select Table)' },
    { id: 3, title: 'เลือกเนื้อ (Select Steak)' },
    { id: 4, title: 'ประสบการณ์ (Experience)' },
    { id: 5, title: 'ยืนยัน (Review)' }
]

export default function SteakBookingWizard() {
    const navigate = useNavigate()
    const { state, dispatch, submitSteakOrder, isDateValid } = useSteakBooking()
    const [direction, setDirection] = useState(1)
    
    // Auto-fill Contact Info
    useEffect(() => {
        const fetchUserString = async () => {
             const { data: { user } } = await supabase.auth.getUser()
             if (user) {
                 // Fetch Profile (More accurate than metadata)
                 const { data: profile } = await supabase.from('profiles').select('display_name, phone_number').eq('id', user.id).single()
                 
                 const name = profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || ''
                 const phone = profile?.phone_number || user.phone || user.user_metadata?.phone || ''
                 
                 if (name) dispatch({ type: 'UPDATE_FORM', payload: { field: 'contactName', value: name } })
                 if (phone) dispatch({ type: 'UPDATE_FORM', payload: { field: 'contactPhone', value: phone } })
             }
        }
        fetchUserString()
    }, [])

    // Sync title based on step? Or just static.
    
    // Animation Variants
    const variants = {
        enter: (d) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (d) => ({ x: d < 0 ? 50 : -50, opacity: 0 })
    }

    const handleNext = () => {
        setDirection(1)
        dispatch({ type: 'NEXT_STEP' })
    }

    const handlePrev = () => {
        if (state.step === 1) {
            navigate('/')
        } else {
            setDirection(-1)
            dispatch({ type: 'PREV_STEP' })
        }
    }

    // Step Logic Map
    const renderStep = () => {
        switch(state.step) {
            case 1: return <StepDateSelector state={state} dispatch={dispatch} onNext={handleNext} isValid={isDateValid} />
            case 2: return <SteakStepTableSelection state={state} dispatch={dispatch} onNext={handleNext} />
            case 3: return <StepSteakSelection state={state} dispatch={dispatch} onNext={handleNext} />
            case 4: return <StepPreferences state={state} dispatch={dispatch} onNext={handleNext} />
            case 5: return <StepReviewOrder state={state} dispatch={dispatch} onSubmit={submitSteakOrder} />
            default: return null
        }
    }

    return (
        <div className="max-w-2xl mx-auto min-h-screen flex flex-col p-6 font-sans">
             {/* Header */}
             <div className="flex items-center justify-between mb-8 z-10 sticky top-0 bg-[#Fdfbf7]/90 backdrop-blur py-4">
                <button onClick={handlePrev} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex gap-2">
                    {STEPS.map(s => (
                        <div 
                            key={s.id} 
                            className={`h-1.5 w-8 rounded-full transition-all duration-300 ${s.id <= state.step ? 'bg-[#1a1a1a]' : 'bg-gray-200'}`} 
                        />
                    ))}
                </div>
             </div>

             {/* Content */}
             <div className="flex-1 relative">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={state.step}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="min-h-[60vh] flex flex-col"
                    >
                        {/* Title of the Step */}
                        <h1 className="text-3xl font-light mb-2 tracking-tight">
                            {STEPS[state.step - 1].title}
                        </h1>
                         <div className="h-px w-10 bg-[#DFFF00] mb-8" />

                        {renderStep()}

                    </motion.div>
                </AnimatePresence>
             </div>
        </div>
    )
}
