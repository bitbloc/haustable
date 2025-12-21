import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Download, Lock } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { formatOptionName } from '../../utils/menuHelper'

export default function BookingSlip({ data, qrCodeUrl, canSave, isCancelled, isForCapture, optionMap = {} }) {
  const { t } = useLanguage()
  const isPickup = data.booking_type === 'pickup'

  return (
    <div className="w-[380px] relative bg-transparent mx-auto">
        {/* Paper Container with Zigzag Edges */}
        <div className="relative bg-white text-black font-inter shadow-xl" 
            style={{
                filter: 'drop-shadow(0px 10px 20px rgba(0,0,0,0.15))',
            }}
        >   
            {/* Header Zigzag */}
            <div className="absolute top-0 left-0 w-full h-4 overflow-hidden" 
                    style={{
                        background: 'linear-gradient(45deg, transparent 33.333%, #ffffff 33.333%, #ffffff 66.667%, transparent 66.667%), linear-gradient(-45deg, transparent 33.333%, #ffffff 33.333%, #ffffff 66.667%, transparent 66.667%)',
                        backgroundSize: '16px 32px',
                        backgroundPosition: '0 -16px',
                        transform: 'rotate(180deg)'
                    }}
            />

            <div className="bg-white pb-8 pt-10 px-6 relative">
                
                {/* 1. Header & ID - SUPER PROMINENT */}
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-black tracking-tighter mb-2">IN THE HAUS</h2>
                    <div className="inline-block border-2 border-black px-4 py-1 rounded-full mb-4">
                        <p className="text-xs font-bold uppercase tracking-widest">{isPickup ? 'PICKUP ORDER' : 'DINE-IN'}</p>
                    </div>

                    <div className="border-y-2 border-black border-dashed py-4">
                        <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider font-bold">Order ID</p>
                        <div className="text-7xl font-mono font-bold tracking-tighter text-black leading-none">
                            #{data.short_id}
                        </div>
                    </div>
                </div>
                
                {/* 2. Customer & Table - PROMINENT */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Customer</p>
                        <p className="font-bold text-lg leading-tight break-words">
                            {data.profiles?.display_name || data.customer_name || 'Guest'}
                        </p>
                    </div>
                    <div className="bg-black text-white p-3 rounded-lg flex flex-col justify-center items-center">
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">
                            {isPickup ? 'Type' : 'Table'}
                        </p>
                        <p className="font-bold text-2xl leading-none">
                            {isPickup ? 'TAKE AWAY' : (data.table_name || data.tables_layout?.table_name || 'TBA')}
                        </p>
                    </div>
                </div>
                
                {/* 3. Items List - DETAILED */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-px bg-gray-200 flex-1"></div>
                        <span className="text-xs font-bold text-gray-400 uppercase">Order Details</span>
                        <div className="h-px bg-gray-200 flex-1"></div>
                    </div>

                    <div className="space-y-4">
                        {data.items?.map((item, idx) => {
                             // Resolve Options
                            let optionsList = []
                            if (item.options) {
                                if (Array.isArray(item.options)) {
                                        optionsList = item.options.map(opt => typeof opt === 'object' ? opt.name : opt)
                                } else if (typeof item.options === 'object') {
                                    const ids = Object.values(item.options).flat()
                                    optionsList = ids.map(id => optionMap[id] || id)
                                }
                            }

                            return (
                                <div key={idx} className="text-sm">
                                    <div className="flex justify-between items-baseline font-bold text-gray-900">
                                        <span><span className="mr-2 text-gray-400 text-xs font-normal">{item.quantity}x</span>{item.menu_items?.name || item.name}</span>
                                        <span>{(item.price * item.quantity).toLocaleString()}</span>
                                    </div>
                                    {optionsList.length > 0 && (
                                        <div className="pl-6 mt-1 text-xs text-gray-500 font-medium space-y-0.5">
                                            {optionsList.map((opt, i) => (
                                                <div key={i} className="flex items-center gap-1">
                                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                    {formatOptionName(opt)}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        {(!data.items || data.items.length === 0) && (
                            <p className="text-center text-gray-400 text-xs italic py-4">No items listed</p>
                        )}
                    </div>
                </div>

                {/* 4. Totals & Discounts */}
                <div className="border-t-2 border-black border-dashed pt-4 mb-8">
                     {/* Discount Details */}
                     {(data.discount_amount > 0) && (
                        <div className="bg-green-50 p-2 rounded border border-green-100 mb-3 flex justify-between items-center text-green-700">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">Discount Applied</span>
                                <span className="text-sm font-bold flex items-center gap-1">
                                    {data.promotion_codes?.code || 'PROMO'} 
                                    {/* Try to infer type if available, otherwise just show amount */}
                                    {/* Ideally backend sends this, but we show raw amount here */}
                                </span>
                            </div>
                            <span className="font-bold text-lg">-{data.discount_amount.toLocaleString()}.-</span>
                        </div>
                    )}

                    <div className="flex justify-between items-baseline">
                        <span className="font-black text-xl">TOTAL</span>
                        <span className="font-black text-3xl">{data.total_amount?.toLocaleString()}.-</span>
                    </div>
                    <p className="text-right text-[10px] text-gray-400 mt-1">Include VAT & Service Charge</p>
                </div>
                
                {/* 5. QR Code */}
                <div className="bg-gray-100 p-4 rounded-xl text-center border border-gray-200">
                    <div className="flex items-center justify-center gap-4">
                        {qrCodeUrl && (
                            <img 
                                src={qrCodeUrl} 
                                className="w-24 h-24 mix-blend-multiply"
                                alt="QR"
                            />
                        )}
                        <div className="text-left">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mb-1">Scan to Track</p>
                            <p className="text-xs font-bold text-black max-w-[120px]">Scan this code to check your order status.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center border-t border-gray-100 pt-4">
                        <p className="text-[10px] text-gray-400">
                            Printed: {new Date().toLocaleString()}
                        </p>
                </div>
            </div>

            {/* Footer Zigzag */}
            <div className="absolute bottom-0 left-0 w-full h-4 overflow-hidden" 
                    style={{
                        background: 'linear-gradient(45deg, transparent 33.333%, #ffffff 33.333%, #ffffff 66.667%, transparent 66.667%), linear-gradient(-45deg, transparent 33.333%, #ffffff 33.333%, #ffffff 66.667%, transparent 66.667%)',
                        backgroundSize: '16px 32px',
                        backgroundPosition: '0 16px'
                    }}
            />
        </div>
    </div>
  )
}

function SlipRow({ label, value }) {
    return (
        <div className="flex justify-between items-baseline">
            <span className="text-gray-400 text-xs uppercase font-medium tracking-wide">{label}</span>
            <span className="font-bold text-gray-900">{value}</span>
        </div>
    )
}
