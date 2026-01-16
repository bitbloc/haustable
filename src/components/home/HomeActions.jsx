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
             {/* Book Table Button - Minimal Glass/Gradient */}
             <Link to={tableStatus.isOpen ? "/booking" : "#"} 
                   className={`relative w-full h-20 mb-6 group overflow-hidden rounded-2xl flex items-center justify-between px-8 border transition-all duration-300
                   ${tableStatus.isOpen 
                     ? 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-[#DFFF00]/50 shadow-lg' 
                     : 'border-white/5 bg-white/5 opacity-50 grayscale cursor-not-allowed'}`}>
                    
                    {/* Animated Gradient Background (Subtle) */}
                    {tableStatus.isOpen && (
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-r from-transparent via-[#DFFF00] to-transparent -translate-x-full group-hover:translate-x-full" style={{ transitionDuration: '1s' }} />
                    )}

                    <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] font-bold tracking-[0.2em] text-[#DFFF00] uppercase">Reservation</span>
                        <span className="font-bold text-2xl tracking-wide text-white uppercase">{t('bookTable')}</span>
                    </div>

                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${tableStatus.isOpen ? 'bg-[#DFFF00] text-black group-hover:scale-110' : 'bg-white/10 text-white/20'}`}>
                        <ArrowRight className="w-5 h-5" />
                    </div>
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
