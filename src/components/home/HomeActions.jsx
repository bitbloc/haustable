import { Link } from 'react-router-dom'
import { ArrowRight, Clock } from 'lucide-react'

export default function HomeActions({ settings, checkStatus, t, user, setShowAuthModal }) {
    if (!settings) return null; // Wait for settings

    if (!user) {
        return (
            <button onClick={() => setShowAuthModal(true)} className="w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-[1.01] active:scale-100 transition-[background-color,transform] duration-200 ease-out shadow-lg flex items-center justify-between px-6">
                <span>Login to Order</span>
                <ArrowRight size={18} className="text-black/70" />
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
                      className={`relative group overflow-hidden w-full py-4 rounded-xl border flex flex-col items-start px-6 justify-center gap-1 transition-[background-color,border-color,transform] duration-200 ease-out
                      ${pickupStatus.isOpen
                         ? 'bg-white/10 border-white/20 text-white hover:bg-white/20 hover:scale-[1.01]'
                         : 'bg-transparent border-white/5 text-white/20 cursor-not-allowed'}`}>
                        <span className="text-xs font-bold opacity-60">ORDER</span> 
                        <span className="font-bold text-md uppercase">{t('orderPickup')}</span>
                 </Link>
              </div>

              {/* Spotify Song Request Button */}
              <div className="w-full mt-1">
                  <Link to="/songs"
                      className="relative group overflow-hidden w-full py-4 rounded-xl border border-[var(--color-accent-green)]/20 bg-[var(--color-accent-green)]/10 hover:bg-[var(--color-accent-green)]/20 hover:scale-[1.01] text-[var(--color-accent-green)] flex flex-col items-start px-6 justify-center gap-1 transition-[background-color,border-color,transform] duration-200 ease-out">
                        <span className="text-xs font-bold opacity-75 flex items-center gap-1">🎵 SPOTIFY QUEUE</span> 
                        <span className="font-bold text-md uppercase">ขอเพลง 100 บาท</span>
                 </Link>
              </div>
        </>
    )
}
