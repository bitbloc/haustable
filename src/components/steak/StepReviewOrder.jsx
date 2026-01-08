import React, { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, Users, MapPin, Upload, FileCheck, PartyPopper, QrCode } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

export default function StepReviewOrder({ state, dispatch, onSubmit }) {
    const { 
        date, time, pax, selectedTable, cart, 
        contactName, contactPhone, slipFile,
        isLoading, error
    } = state

    const fileInputRef = useRef(null)
    const [qrCodeUrl, setQrCodeUrl] = useState(null)

    const totalPrice = cart.reduce((a, b) => a + (b.price * b.quantity), 0)
    const totalQty = cart.reduce((a, b) => a + b.quantity, 0)

    // Fetch Payment QR
    useEffect(() => {
        const fetchQR = async () => {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'payment_qr_url').single()
            if (data?.value) setQrCodeUrl(data.value)
        }
        fetchQR()
    }, [])

    const handleSubmit = async () => {
         const result = await onSubmit()
         if (result.success) {
             window.location.href = `/tracking/${result.trackingToken}`
         }
    }

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            dispatch({ type: 'UPDATE_FORM', payload: { field: 'slipFile', value: e.target.files[0] } })
        }
    }

    return (
        <div className="flex-1 overflow-y-auto pb-32">
            <h2 className="text-2xl font-light mb-6">Booking Summary</h2>

            {/* Booking Info Card */}
            <div className="bg-[#1a1a1a] text-white p-6 rounded-2xl shadow-lg mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><PartyPopper size={100} /></div>
                
                <div className="grid grid-cols-2 gap-y-6 relative z-10">
                    <div>
                        <div className="text-xs text-gray-400 uppercase mb-1 flex items-center gap-1"><Calendar size={12} /> Date</div>
                        <div className="font-bold text-lg">{date}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-400 uppercase mb-1 flex items-center gap-1"><Clock size={12} /> Time</div>
                        <div className="font-bold text-lg">{time}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-400 uppercase mb-1 flex items-center gap-1"><Users size={12} /> Guests</div>
                        <div className="font-bold text-lg">{pax} Pax</div>
                    </div>
                     <div>
                        <div className="text-xs text-gray-400 uppercase mb-1 flex items-center gap-1"><MapPin size={12} /> Zone</div>
                        <div className="font-bold text-lg">{selectedTable?.table_name || 'N/A'}</div>
                    </div>
                </div>
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 border-b pb-2">Pre-order Items</h3>
                <div className="space-y-4">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start">
                             <div className="flex gap-3">
                                <div className="font-bold text-gray-300">x{item.quantity}</div>
                                <div>
                                    <div className="font-bold text-sm">{item.name}</div>
                                    <div className="text-xs text-gray-500">{item.doneness?.name}</div>
                                </div>
                             </div>
                             <div className="font-mono text-sm">฿{(item.price * item.quantity).toLocaleString()}</div>
                        </div>
                    ))}
                    <div className="border-t pt-4 mt-4 flex justify-between items-end">
                        <div className="text-xs text-gray-400 font-bold uppercase">Total Estimate</div>
                        <div className="font-mono text-2xl font-bold">฿{totalPrice.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* Contact & Slip Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Contact & Payment</h3>
                
                {/* QR Code Section */}
                {qrCodeUrl && (
                    <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-200 mb-4">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                            <QrCode size={14} /> Scan to Pay
                        </div>
                        <div className="bg-white p-2 rounded-lg shadow-sm">
                            <img src={qrCodeUrl} className="w-40 h-40 object-contain" alt="Payment QR" />
                        </div>
                        <div className="text-[#1a1a1a] font-mono font-bold text-lg mt-2">฿{totalPrice.toLocaleString()}</div>
                    </div>
                )}

                <input 
                    type="text" placeholder="Your Name" 
                    value={contactName}
                    onChange={e => dispatch({ type: 'UPDATE_FORM', payload: { field: 'contactName', value: e.target.value } })}
                    className="w-full p-4 bg-gray-50 rounded-xl outline-none text-sm font-bold focus:ring-1 focus:ring-black"
                />
                 <input 
                    type="tel" placeholder="Phone Number" 
                    value={contactPhone}
                    onChange={e => dispatch({ type: 'UPDATE_FORM', payload: { field: 'contactPhone', value: e.target.value } })}
                    className="w-full p-4 bg-gray-50 rounded-xl outline-none text-sm font-bold focus:ring-1 focus:ring-black"
                />

                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${slipFile ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-black'}`}
                >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    {slipFile ? (
                        <>
                            <FileCheck className="text-green-500 mb-2" />
                            <span className="text-green-600 font-bold text-sm">{slipFile.name}</span>
                        </>
                    ) : (
                        <>
                            <Upload className="text-gray-400 mb-2" />
                            <span className="text-gray-500 text-xs font-bold uppercase">Upload Payment Slip</span>
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm text-center font-bold mb-6">
                    {error}
                </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur border-t border-gray-200 z-30">
                <div className="max-w-2xl mx-auto">
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !contactName || !contactPhone || !slipFile}
                        className="w-full bg-[#1a1a1a] text-[#DFFF00] py-4 rounded-full font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>Confirm Booking</>
                        )}
                    </button>
                    {!slipFile && <p className="text-[10px] text-center text-gray-400 mt-2">*Please upload slip to confirm</p>}
                </div>
            </div>
        </div>
    )
}
