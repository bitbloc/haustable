import React from 'react'
import { Wine, Cake, Heart, Briefcase, User, Info, AlertCircle } from 'lucide-react'

export default function StepPreferences({ state, dispatch, onNext }) {
    const { occasion, winePreference, specialRequest, dietaryRestrictions, cakeRequest } = state

    const occasions = [
        { id: 'general', label: 'Casual Dining', icon: User },
        { id: 'birthday', label: 'Birthday', icon: Cake },
        { id: 'anniversary', label: 'Anniversary', icon: Heart },
        { id: 'business', label: 'Business', icon: Briefcase },
    ]

    return (
        <div className="flex-1 overflow-y-auto pb-24 space-y-8">
            
            {/* Occasion */}
            <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Occasion</h3>
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
                 <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Special Details</h3>
                 
                 {/* Cake / Decor */}
                 <div className="bg-white p-4 rounded-xl border border-gray-100 focus-within:ring-1 focus-within:ring-black">
                    <label className="block text-xs font-bold text-gray-500 mb-2">Cake / Special Decoration Request</label>
                    <input 
                        type="text" 
                        value={cakeRequest} 
                        onChange={e => dispatch({ type: 'UPDATE_FORM', payload: { field: 'cakeRequest', value: e.target.value } })}
                        placeholder="Need a cake? Write here..."
                        className="w-full outline-none text-sm placeholder-gray-300"
                    />
                 </div>

                 {/* Dietary */}
                 <div className="bg-white p-4 rounded-xl border border-gray-100 focus-within:ring-1 focus-within:ring-black">
                    <label className="block text-xs font-bold text-gray-500 mb-2">Dietary Restrictions / Allergies</label>
                    <input 
                        type="text" 
                        value={dietaryRestrictions} 
                        onChange={e => dispatch({ type: 'UPDATE_FORM', payload: { field: 'dietaryRestrictions', value: e.target.value } })}
                        placeholder="e.g. No Nuts, Gluten Free..."
                        className="w-full outline-none text-sm placeholder-gray-300"
                    />
                 </div>
            </div>

            {/* Wine */}
            <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Wine & Pairing</h3>
                <div className="space-y-3">
                    <button
                        onClick={() => dispatch({ type: 'UPDATE_FORM', payload: { field: 'winePreference', value: 'bin2' } })}
                        className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${winePreference === 'bin2' ? 'bg-[#1a1a1a] text-white border-black' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'}`}
                    >
                        <Wine size={24} />
                        <div className="text-left">
                            <div className="font-bold text-sm">Recommend Bin 2 Pairing</div>
                            <div className="text-xs opacity-70">Perfect match for Wagyu</div>
                        </div>
                    </button>

                    <button
                        onClick={() => dispatch({ type: 'UPDATE_FORM', payload: { field: 'winePreference', value: 'corkage' } })}
                        className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${winePreference === 'corkage' ? 'bg-[#1a1a1a] text-white border-black' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'}`}
                    >
                        <Wine size={24} />
                        <div className="text-left">
                            <div className="font-bold text-sm">Bring Your Own Bottle</div>
                            <div className="text-xs opacity-70">Corkage Fee 100 THB/Bottle</div>
                        </div>
                    </button>

                     <button
                        onClick={() => dispatch({ type: 'UPDATE_FORM', payload: { field: 'winePreference', value: 'none' } })}
                        className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${winePreference === 'none' ? 'bg-[#1a1a1a] text-white border-black' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'}`}
                    >
                        <div className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">✕</div>
                        <div className="text-left">
                            <div className="font-bold text-sm">No Wine Preference</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* General Note */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 focus-within:ring-1 focus-within:ring-black">
                <label className="block text-xs font-bold text-gray-500 mb-2">Special Request (optional)</label>
                <textarea 
                    value={specialRequest} 
                    onChange={e => dispatch({ type: 'UPDATE_FORM', payload: { field: 'specialRequest', value: e.target.value } })}
                    placeholder="Quiet corner, Baby Chair, High Chair..."
                    className="w-full outline-none text-sm placeholder-gray-300 resize-none h-20"
                />
            </div>

             <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur border-t border-gray-200">
                <div className="max-w-2xl mx-auto">
                    <button
                        onClick={onNext}
                        className="w-full bg-[#1a1a1a] text-white py-4 rounded-full font-bold shadow-lg hover:scale-[1.02] transition-transform"
                    >
                        Review Booking
                    </button>
                </div>
            </div>
        </div>
    )
}
