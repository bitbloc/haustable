import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useBooking } from '../../hooks/useBooking'
import StepDateSelection from './StepDateSelection'
import StepTableSelection from './StepTableSelection'
import StepFood from './StepFood'

const slideVariants = {
    enter: (direction) => ({ x: direction > 0 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction) => ({ x: direction < 0 ? 50 : -50, opacity: 0 }),
}

export default function BookingSteps() {
    const navigate = useNavigate()
    const {
        step, direction, prevStep,
        isCheckoutMode, setCheckoutMode, isLoading
    } = useBooking()

    // Loading State (Global)
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#F8F8F8] p-6 flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="w-32 h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="w-48 h-3 bg-gray-200 rounded animate-pulse"></div>
            </div>
        )
    }

    const handleBack = () => {
        if (step === 3 && isCheckoutMode) {
            setCheckoutMode(false)
            return
        }
        if (step === 1) navigate('/')
        else prevStep()
    }

    return (
        <div className="min-h-screen bg-[#F9F9F9] flex flex-col p-6 font-sans text-black">
            {/* Top Nav */}
            <div className="flex justify-between items-center mb-6">
                <button onClick={handleBack} className="p-2 hover:bg-white rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex gap-1">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`h-1 w-8 rounded-full transition-all duration-500 ${i <= step ? 'bg-black' : 'bg-gray-200'} `} />
                    ))}
                </div>
            </div>

            <div className="flex-1 max-w-lg mx-auto w-full relative">
                <AnimatePresence custom={direction} mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                            className="h-full flex flex-col"
                        >
                            <StepDateSelection />
                        </motion.div>
                    )}
                    {step === 2 && (
                        <motion.div
                            key="step2" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                            className="h-full flex flex-col relative"
                        >
                            <StepTableSelection />
                        </motion.div>
                    )}
                    {step === 3 && (
                        <motion.div
                            key="step3" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                            className="h-full flex flex-col"
                        >
                            <StepFood />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
