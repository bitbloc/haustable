import React, { useState, useEffect } from 'react'
import { Wine, Cake, Heart, Briefcase, User, Info, AlertCircle, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

export default function StepPreferences({ state, dispatch, onNext }) {
    const { occasion, winePreference, specialRequest, dietaryRestrictions, cakeRequest } = state
    const [config, setConfig] = useState({})

    useEffect(() => {
        const fetchConfig = async () => {
            const { data } = await supabase.from('app_settings').select('*').in('key', [
                'steak_qt_cake_label', 'steak_qt_cake_placeholder',
                'steak_qt_dietary_label', 'steak_qt_dietary_placeholder',
                'steak_wine_pairing_label', 'steak_wine_pairing_desc', 'steak_wine_pairing_price',
                'steak_corkage_fee'
            ])
            if (data) {
                const map = data.reduce((acc, item) => ({...acc, [item.key]: item.value}), {})
                setConfig(map)
            }
        }
        fetchConfig()
    }, [])

    const occasions = [
        { id: 'general', label: 'ทานทั่วไป (Casual)', icon: User },
        { id: 'birthday', label: 'วันเกิด (Birthday)', icon: Cake },
        { id: 'anniversary', label: 'วันครบรอบ (Anniversary)', icon: Heart },
        { id: 'business', label: 'คุยธุรกิจ (Business)', icon: Briefcase },
    ]

    return (
        <div className="flex-1 overflow-y-auto pb-24 space-y-8">
            
            {/* Occasion */}
            <div>
                <h3 className="text-sm font-bold text-gray-900 mb-4">เนื่องในโอกาส <span className="text-xs text-gray-400 font-normal uppercase">(Occasion)</span></h3>
                <div className="grid grid-cols-2 gap-3">
                    {occasions.map(occ => {
                        const Icon = occ.icon
                        return (
                            <button
                                key={occ.id}
                                onClick={() => dispatch({ type: 'UPDATE_FORM', payload: { field: 'occasion', value: occ.id } })}
                                className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${occasion === occ.id ? 'bg-[#1a1a1a] text-white border-black' : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'}`}
                            >
                                <Icon size={24} />
                                <span className="text-sm font-medium">{occ.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Extras Form */}
            <div className="space-y-4">
                 <h3 className="text-sm font-bold text-gray-900 mb-4">รายละเอียดเพิ่มเติม <span className="text-xs text-gray-400 font-normal uppercase">(Special Details)</span></h3>
                 
                 {/* Cake / Decor */}
                 <div className="bg-white p-4 rounded-xl border border-gray-100 focus-within:ring-1 focus-within:ring-black">
                    <label className="block text-xs font-bold text-gray-500 mb-2">{config.steak_qt_cake_label || 'Cake / Special Decoration Request'}</label>
                    <input 
                        type="text" 
                        value={cakeRequest} 
                        onChange={e => dispatch({ type: 'UPDATE_FORM', payload: { field: 'cakeRequest', value: e.target.value } })}
                        placeholder={config.steak_qt_cake_placeholder || "Need a cake? Write here..."}
                        className="w-full outline-none text-sm placeholder-gray-300"
                    />
                 </div>

                 {/* Dietary */}
                 <div className="bg-white p-4 rounded-xl border border-gray-100 focus-within:ring-1 focus-within:ring-black">
                    <label className="block text-xs font-bold text-gray-500 mb-2">{config.steak_qt_dietary_label || 'Dietary Restrictions / Allergies'}</label>
                    <input 
                        type="text" 
                        value={dietaryRestrictions} 
                        onChange={e => dispatch({ type: 'UPDATE_FORM', payload: { field: 'dietaryRestrictions', value: e.target.value } })}
                        placeholder={config.steak_qt_dietary_placeholder || "e.g. No Nuts, Gluten Free..."}
                        className="w-full outline-none text-sm placeholder-gray-300"
                    />
                 </div>
            </div>

            {/* Wine */}
            <div>
                <h3 className="text-sm font-bold text-gray-900 mb-4">ไวน์และเครื่องดื่ม <span className="text-xs text-gray-400 font-normal uppercase">(Wine & Pairing)</span></h3>
                <div className="space-y-3">
                    <button
                        onClick={() => dispatch({ type: 'UPDATE_FORM', payload: { field: 'winePreference', value: 'bin2' } })}
                        className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${winePreference === 'bin2' ? 'bg-[#1a1a1a] text-white border-black' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'}`}
                    >
                        <Wine size={24} />
                        <div className="text-left flex-1">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-sm">{config.steak_wine_pairing_label || 'Recommend Bin 2 Pairing'}</span>
                                {config.steak_wine_pairing_price && <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{config.steak_wine_pairing_price}</span>}
                            </div>
                            <div className="text-xs opacity-70">{config.steak_wine_pairing_desc || 'Perfect match for Wagyu'}</div>
                        </div>
                    </button>

                    <button
                        onClick={() => dispatch({ type: 'UPDATE_FORM', payload: { field: 'winePreference', value: 'corkage' } })}
                        className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${winePreference === 'corkage' ? 'bg-[#1a1a1a] text-white border-black' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'}`}
                    >
                        <Wine size={24} />
                        <div className="text-left">
                            <div className="font-bold text-sm">นำไวน์มาเอง (BYOB)</div>
                            <div className="text-xs opacity-70">{config.steak_corkage_fee || 'Corkage Fee 100 THB/Bottle'}</div>
                        </div>
                    </button>

                     <button
                        onClick={() => dispatch({ type: 'UPDATE_FORM', payload: { field: 'winePreference', value: 'none' } })}
                        className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${winePreference === 'none' ? 'bg-[#1a1a1a] text-white border-black' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'}`}
                    >
                        <div className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">✕</div>
                        <div className="text-left">
                            <div className="font-bold text-sm">ไม่รับเครื่องดื่ม (No Benefit)</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* General Note */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 focus-within:ring-1 focus-within:ring-black">
                <label className="block text-xs font-bold text-gray-500 mb-2">คำขอพิเศษอื่นๆ (Special Request)</label>
                <textarea 
                    value={specialRequest} 
                    onChange={e => dispatch({ type: 'UPDATE_FORM', payload: { field: 'specialRequest', value: e.target.value } })}
                    placeholder="Quiet corner, Baby Chair, High Chair..."
                    className="w-full outline-none text-sm placeholder-gray-300 resize-none h-20"
                />
            </div>

            {/* Contact Info */}
            <div className="flex items-center gap-2 justify-center text-gray-400 text-xs py-2">
                <Phone size={12} />
                <span>For more details call 061-423-2455</span>
            </div>
             <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur border-t border-gray-200">
                <div className="max-w-2xl mx-auto">
                    <button
                        onClick={onNext}
                        className="w-full bg-[#1a1a1a] text-white py-4 rounded-full font-bold shadow-lg hover:scale-[1.02] transition-transform"
                    >
                        ตรวจสอบข้อมูล <span className="text-xs opacity-70 font-normal ml-1">(Review Booking)</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
