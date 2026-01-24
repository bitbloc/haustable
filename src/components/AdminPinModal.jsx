import { useState, useEffect } from 'react'
import { X, Lock, Calculator } from 'lucide-react'

export default function AdminPinModal({ isOpen, onClose, onConfirm, title = "Security Verification", message = "Please enter Staff PIN to continue." }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (isOpen) {
        setPin('')
        setError(false)
    }
  }, [isOpen])

  const handleNumberClick = (num) => {
    if (pin.length < 6) {
        setPin(prev => prev + num)
        setError(false)
    }
  }

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm(pin)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-paper border border-gray-200 rounded-2xl w-full max-w-xs shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-subInk hover:text-ink transition-colors"
        >
            <X size={20} />
        </button>

        <div className="p-6 pb-2 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-5 h-5 text-ink" />
            </div>
            <h3 className="text-lg font-bold text-ink mb-2">{title}</h3>
            <p className="text-subInk text-xs mb-6">{message}</p>

            <div className="mb-6">
                <input 
                    type="password" 
                    value={pin}
                    readOnly
                    className={`w-full bg-canvas border ${error ? 'border-red-500' : 'border-gray-200'} rounded-xl py-4 text-center text-2xl font-bold tracking-[1em] text-ink focus:outline-none transition-colors h-16`}
                    placeholder="••••"
                />
                {error && <p className="text-red-500 text-xs mt-2">Incorrect PIN</p>}
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                        key={num}
                        onClick={() => handleNumberClick(num.toString())}
                        className="h-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-lg text-xl font-bold text-ink transition-colors flex items-center justify-center border border-gray-100 shadow-sm"
                    >
                        {num}
                    </button>
                ))}
                
                <div /* Spacer */></div>
                <button
                    onClick={() => handleNumberClick('0')}
                    className="h-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-lg text-xl font-bold text-ink transition-colors flex items-center justify-center border border-gray-100 shadow-sm"
                >
                    0
                </button>
                <button
                    onClick={handleBackspace}
                    className="h-14 bg-gray-50 hover:bg-red-50 active:bg-red-100 rounded-lg text-ink transition-colors flex items-center justify-center border border-gray-100 shadow-sm"
                >
                    <X size={20} />
                </button>
            </div>

            <button 
                onClick={handleSubmit}
                disabled={pin.length < 4}
                className="w-full bg-brand text-ink font-bold py-3.5 rounded-xl hover:bg-brandDark disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand/20"
            >
                Confirm
            </button>
        </div>
      </div>
    </div>
  )
}
