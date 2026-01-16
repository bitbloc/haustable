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
    const steakStatus = checkStatus(settings, 'shop_mode_steak')
    const pickupStatus = checkStatus(settings, 'shop_mode_pickup')

    return (
        <>
             {/* Book Table Button */}
             <Link to={tableStatus.isOpen ? "/booking" : "#"} 
                   className={`relative group overflow-hidden w-full py-5 rounded-2xl border flex items-center justify-center gap-3 transition-all duration-300
                   ${tableStatus.isOpen 
                     ? 'bg-[#DFFF00] border-[#DFFF00] text-black hover:shadow-[0_0_20px_rgba(223,255,0,0.4)]' 
                     : 'bg-transparent border-white/10 text-white/30 cursor-not-allowed'}`}>
                    
                    <span className="font-bold text-lg tracking-wide uppercase">{t('bookTable')}</span>
                    {tableStatus.isOpen && <ArrowRight className="group-hover:translate-x-1 transition" />}
             </Link>

             {/* Steak / Pickup Buttons (Secondary Style) */}
             <div className="grid grid-cols-2 gap-4 w-full">
                {/* Steak */}
                <Link to={steakStatus.isOpen ? "/steak-preorder" : "#"}
                     className={`relative group overflow-hidden w-full py-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-300
                     ${steakStatus.isOpen
                        ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                        : 'bg-transparent border-white/5 text-white/20 cursor-not-allowed'}`}>
                       <span className="text-xs font-bold opacity-60">PRE-ORDER</span> 
                       <span className="font-bold text-md uppercase">Steaks</span>
                </Link>

                {/* Pickup */}
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
