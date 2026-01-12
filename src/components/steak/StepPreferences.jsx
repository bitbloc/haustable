import React, { useState, useEffect } from 'react'
import { Wine, Cake, Heart, Briefcase, User, Info, AlertCircle, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

export default function StepPreferences({ state, dispatch, onNext }) {
    const { 
        occasion, winePreference, specialRequest, dietaryRestrictions, 
        addCake, cakeDetail, addFlower, flowerDetail 
    } = state
    const [config, setConfig] = useState({})

    useEffect(() => {
        const fetchConfig = async () => {
            const { data } = await supabase.from('app_settings').select('*').in('key', [
                'steak_addon_cake_price', 'steak_addon_flower_price',
                'steak_addon_cake_enabled', 'steak_addon_flower_enabled',
                'steak_addon_cake_name', 'steak_addon_flower_name',
                'steak_qt_dietary_label', 'steak_qt_dietary_placeholder',
                'steak_wine_list', 'steak_corkage_fee', 'steak_corkage_price'
            ])
            if (data) {
                const map = data.reduce((acc, item) => ({...acc, [item.key]: item.value}), {})
                
                // Parse Wine List
                try {
                    map.wineList = JSON.parse(map.steak_wine_list || '[]')
                } catch (e) {
                    map.wineList = []
                }

                setConfig(map)
                
                // Update config into hook state for price calc
                dispatch({ 
                    type: 'UPDATE_FORM', 
                    payload: { 
                        field: 'config', 
                        value: {
                            cakePrice: parseInt(map.steak_addon_cake_price || 0),
                            flowerPrice: parseInt(map.steak_addon_flower_price || 0),
                            cakeName: map.steak_addon_cake_name || 'Cake Service',
                            flowerName: map.steak_addon_flower_name || 'Flower Service'
                        } 
                    } 
                })
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
        <div className="flex-1 overflow-y-auto pb-32 space-y-8">
            
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
                 
                 {/* Cake Add-on */}
                 {config.steak_addon_cake_enabled !== 'false' && (
                     <div className={`p-4 rounded-xl border transition-all ${addCake ? 'bg-white border-black ring-1 ring-black' : 'bg-white border-gray-100'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-2">
                            <input 
                                type="checkbox" 
                                checked={addCake} 
                                onChange={e => dispatch({ type: 'UPDATE_FORM', payload: { field: 'addCake', value: e.target.checked } })}
                                className="w-5 h-5 accent-black"
                            />
                            <div>
                                <span className="font-bold text-sm text-gray-900 flex items-center gap-2">
                                    <Cake size={16} /> {config.steak_addon_cake_name || 'รับเค้ก (Receive Cake)'}
                                </span>
                                <span className="text-xs text-gray-500 block">
                                    +{parseInt(config.steak_addon_cake_price || 1000).toLocaleString()} THB (Adjustable)
                                </span>
                            </div>
                        </label>
                        
                        {addCake && (
                            <input 
                                type="text" 
                                value={cakeDetail} 
                                onChange={e => dispatch({ type: 'UPDATE_FORM', payload: { field: 'cakeDetail', value: e.target.value } })}
                                placeholder="รายละเอียดเค้ก (Cake Message / Details)..."
                                className="w-full mt-2 p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none focus:border-gray-300 transition-colors"
                            />
                        )}
                     </div>
                 )}

                 {/* Flower Add-on */}
                 {config.steak_addon_flower_enabled !== 'false' && (
                     <div className={`p-4 rounded-xl border transition-all ${addFlower ? 'bg-white border-black ring-1 ring-black' : 'bg-white border-gray-100'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-2">
                            <input 
                                type="checkbox" 
                                checked={addFlower} 
                                onChange={e => dispatch({ type: 'UPDATE_FORM', payload: { field: 'addFlower', value: e.target.checked } })}
                                className="w-5 h-5 accent-black"
                            />
                            <div>
                                <span className="font-bold text-sm text-gray-900 flex items-center gap-2">
                                    <Heart size={16} /> {config.steak_addon_flower_name || 'รับดอกไม้ (Receive Flower)'}
                                </span>
                                 <span className="text-xs text-gray-500 block">
                                    +{parseInt(config.steak_addon_flower_price || 1000).toLocaleString()} THB (Adjustable)
                                </span>
                            </div>
                        </label>
                        
                        {addFlower && (
                            <input 
                                type="text" 
                                value={flowerDetail} 
                                onChange={e => dispatch({ type: 'UPDATE_FORM', payload: { field: 'flowerDetail', value: e.target.value } })}
                                placeholder="ประเภท/สีดอกไม้ หรือข้อความ (Flower Type/Color)..."
                                className="w-full mt-2 p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none focus:border-gray-300 transition-colors"
                            />
                        )}
                     </div>
                 )}

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
                    {/* Dynamic Wine List */}
                    {config.wineList && config.wineList.map((wine, idx) => {
                        const isSelected = winePreference?.name === wine.name
                        return (
                            <button
                                key={idx}
                                onClick={() => dispatch({ type: 'UPDATE_FORM', payload: { field: 'winePreference', value: wine } })}
                                className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${isSelected ? 'bg-[#1a1a1a] text-white border-black' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'}`}
                            >
                                <Wine size={24} />
                                <div className="text-left flex-1">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-sm">{wine.name}</span>
                                        <span className="text-xs font-mono bg-gray-100 opacity-80 text-black px-2 py-1 rounded">+{wine.price?.toLocaleString()}</span>
                                    </div>
                                    <div className="text-xs opacity-70 mt-1">{wine.description}</div>
                                </div>
                            </button>
                        )
                    })}

                    <button
                        onClick={() => dispatch({ type: 'UPDATE_FORM', payload: { field: 'winePreference', value: { name: 'นำไวน์มาเอง (BYOB)', price: parseInt(config.steak_corkage_price || 0), type: 'corkage' } } })}
                        className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${winePreference?.type === 'corkage' ? 'bg-[#1a1a1a] text-white border-black' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'}`}
                    >
                        <Wine size={24} />
                        <div className="text-left">
                            <div className="font-bold text-sm">นำไวน์มาเอง (BYOB)</div>
                            <div className="text-xs opacity-70">
                                {config.steak_corkage_fee || 'Corkage Fee'}: {parseInt(config.steak_corkage_price || 0).toLocaleString()} THB
                            </div>
                        </div>
                    </button>

                     <button
                        onClick={() => dispatch({ type: 'UPDATE_FORM', payload: { field: 'winePreference', value: null } })}
                        className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${!winePreference ? 'bg-[#1a1a1a] text-white border-black' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'}`}
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
             <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur border-t border-gray-200 z-50">
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
