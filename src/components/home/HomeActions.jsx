import { Link } from 'react-router-dom'
import { ArrowRight, Clock } from 'lucide-react'

export default function HomeActions({ settings, checkStatus, t, user, setShowAuthModal }) {
    if (!settings) return null; // Wait for settings

    if (!user) {
        return (
            <button onClick={() => setShowAuthModal(true)} className="w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-[1.02] transition shadow-lg">
                Login to Order
            </button>
        )
    }

    const tableStatus = checkStatus(settings, 'shop_mode_table')

    const pickupStatus = checkStatus(settings, 'shop_mode_pickup')

    return (
        <>


             {/* Pickup - now full width */}
             <div className="w-full">
                 <Link to={pickupStatus.isOpen ? "/pickup" : "#"}
                     className={`relative group overflow-hidden w-full py-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-300
                     ${pickupStatus.isOpen
                        ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                        : 'bg-transparent border-white/5 text-white/20 cursor-not-allowed'}`}>
                       <span className="text-xs font-bold opacity-60">ORDER</span> 
                       <span className="font-bold text-md uppercase">{t('orderPickup')}</span>
                </Link>
             </div>
        </>
    )
}
