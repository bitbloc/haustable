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
             {/* Book Table Button - Ticket Style */}
             <Link to={tableStatus.isOpen ? "/booking" : "#"} 
                   className={`relative w-full h-24 mb-6 group transition-transform hover:-translate-y-1 duration-300 ${!tableStatus.isOpen && 'opacity-50 grayscale cursor-not-allowed'}`}>
                    
                    {/* Ticket Shape */}
                    <div className="absolute inset-0 bg-[#DFFF00] w-full h-full"
                         style={{
                             clipPath: 'polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0% 50%)'
                             /* Simple polygonal shape, or we can simply use the rounded corners with pseudo elements for notches */
                         }}
                    >
                         {/* We'll use a simpler "Notched" Card using utility classes and mask if possible, or visually fake it with circles */}
                    </div>

                    {/* Better Ticket Implementation using CSS Mask */}
                    <div className={`absolute inset-0 bg-[#DFFF00] text-black ${tableStatus.isOpen ? 'shadow-[0_0_30px_rgba(223,255,0,0.3)]' : ''}`}
                         style={{
                             maskImage: 'radial-gradient(circle at left center, transparent 10px, black 11px), radial-gradient(circle at right center, transparent 10px, black 11px)',
                             maskPosition: '0 0, 0 0',
                             maskSize: '100% 100%',
                             maskComposite: 'intersect',
                             WebkitMaskImage: 'radial-gradient(circle at left center, transparent 10px, black 11px), radial-gradient(circle at right center, transparent 10px, black 11px)',
                             WebkitMaskComposite: 'source-in'
                         }}
                    />

                    {/* Content */}
                    <div className="absolute inset-0 flex items-center justify-between px-8 text-black z-10">
                        <div className="flex flex-col items-start border-r border-black/10 pr-6 w-full">
                            <span className="text-[10px] font-bold tracking-[0.3em] opacity-60">BOOKING TICKET</span>
                            <span className="font-black text-2xl tracking-tighter uppercase">{t('bookTable')}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center pl-4 opacity-80 group-hover:opacity-100 transition-opacity">
                             {/* Fake Barcode Lines */}
                             <div className="flex gap-0.5 h-8 w-12 justify-center">
                                 <div className="w-1 bg-black h-full"></div>
                                 <div className="w-0.5 bg-black h-full"></div>
                                 <div className="w-2 bg-black h-full"></div>
                                 <div className="w-1 bg-black h-full"></div>
                                 <div className="w-0.5 bg-black h-full"></div>
                                 <div className="w-2 bg-black h-full"></div>
                             </div>
                             <ArrowRight className="w-5 h-5 mt-2" />
                        </div>
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
