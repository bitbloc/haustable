import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import QRCode from 'qrcode'
import { Download, Lock } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

export default function BookingSlip({ data, qrCodeUrl, canSave, isCancelled }) {
  const { t } = useLanguage()
  const slipRef = useRef(null)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
      if (!slipRef.current) return
      if (!qrCodeUrl) return alert("QR Code ยังไม่พร้อม")

      setDownloading(true)
      try {
          // Wait for fonts to be ready
          await document.fonts.ready
          // Small delay for render sync
          await new Promise(r => setTimeout(r, 100))

          const dataUrl = await toPng(slipRef.current, {
              cacheBust: true,
              backgroundColor: 'transparent', // We handle bg in the component
              pixelRatio: 3, // High quality
              skipAutoScale: true,
              style: {
                transform: 'scale(1)', // Reset any potential transforms
              }
          })
          
          const link = document.createElement('a')
          link.href = dataUrl
          link.download = `Slip-${data.short_id}.png`
          link.click()
          
      } catch (err) {
          console.error("Slip Error:", err)
          if (err.message && err.message.includes('lab')) {
             alert("ขออภัย Browser ของคุณไม่รองรับการบันทึกภาพนี้ (Color Format Error) \nแนะนำให้แคปหน้าจอแทนครับ")
          } else {
             alert("ไม่สามารถบันทึกรูปได้: " + err.message)
          }
      } finally {
          setDownloading(false)
      }
  }

  const isPickup = data.booking_type === 'pickup'

  return (
    <>
      <button 
        onClick={handleDownload}
        disabled={!canSave || downloading || isCancelled}
        className={`w-full border py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all
            ${(canSave && !isCancelled)
                ? 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900 active:scale-[0.98]' 
                : 'bg-gray-100 border-transparent text-gray-400 cursor-not-allowed'}
        `}
      >
          {canSave ? <Download size={18} /> : <Lock size={18} />}
          {downloading ? t('saving') : `${t('saveSlip')} (#${data.short_id || data.id?.slice(0,4)})`}
      </button>

      {/* Hidden Slip Render Area */}
      {/* Position fixed off-screen ensures it renders properly but is invisible to user */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none">
          <div ref={slipRef} className="w-[400px] relative bg-transparent p-4">
               {/* Paper Container with Zigzag Edges */}
               <div className="relative bg-white text-black font-inter shadow-xl overflow-hidden" 
                    style={{
                        filter: 'drop-shadow(0px 10px 20px rgba(0,0,0,0.15))',
                        // CSS Mask for Zigzag Top and Bottom
                        // We use a complex mask to create the sawtooth effect
                        maskImage: `
                            radial-gradient(circle at 10px 10px, transparent 10px, black 10px),
                            radial-gradient(circle at 10px calc(100% - 10px), transparent 10px, black 10px)
                        `,
                        maskPosition: '0 0, 0 0', // This needs careful CSS, let's try a simpler robust approach for mask
                        // Alternative safe approach: CSS radial-gradient background for edges
                    }}
                >   
                   {/* Simplified approach for robust rendering: Use CSS Radial Gradients to "cut" the edges */}
                   <div className="bg-white pb-8 pt-8 px-8 relative">
                        {/* Top Zigzag Pattern */}
                        <div className="absolute top-0 left-0 w-full h-4 overflow-hidden" 
                             style={{
                                 background: 'linear-gradient(45deg, transparent 33.333%, #ffffff 33.333%, #ffffff 66.667%, transparent 66.667%), linear-gradient(-45deg, transparent 33.333%, #ffffff 33.333%, #ffffff 66.667%, transparent 66.667%)',
                                 backgroundSize: '16px 32px',
                                 backgroundPosition: '0 -16px',
                                 transform: 'rotate(180deg)'
                             }}
                        />

                        {/* Content */}
                       <div className="mb-6 text-center">
                           <h2 className="text-3xl font-black tracking-tighter mb-1">IN THE HAUS</h2>
                           <p className="text-[10px] text-gray-400 uppercase tracking-[0.3em]">Official Receipt</p>
                       </div>
                       
                       <div className="border-t-2 border-dashed border-gray-200 py-6 mb-6 text-center">
                           <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Order ID</p>
                           <div className="text-6xl font-mono font-bold tracking-tighter text-black">#{data.short_id}</div>
                       </div>
                       
                       <div className="space-y-3 mb-8 text-sm">
                           <SlipRow label="Guest" value={data.profiles?.display_name ? `คุณ ${data.profiles.display_name}` : (data.customer_name || data.pickup_contact_name || '-')} />
                           <SlipRow label="Date" value={new Date(data.booking_time).toLocaleDateString()} />
                           <SlipRow label="Time" value={new Date(data.booking_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} />
                           
                           {!isPickup && (data.table_name || data.tables_layout?.table_name) && (
                                <SlipRow label="Table" value={data.table_name || data.tables_layout?.table_name} />
                           )}
                           {isPickup && <SlipRow label="Type" value="Take Away" />}

                           {data.items?.length > 0 && (
                                <SlipRow label="Items" value={`${data.items.length} items`} />
                           )}

                           {(data.discount_amount > 0 || data.promotion_codes?.code) && (
                                <div className="flex justify-between items-baseline text-green-600">
                                    <span className="text-xs uppercase font-medium tracking-wide">Discount</span>
                                    <span className="font-bold">-{data.discount_amount?.toLocaleString()}.-</span>
                                </div>
                           )}
                           
                           <div className="flex justify-between border-t-2 border-dashed border-gray-200 pt-4 mt-6">
                               <span className="font-bold text-lg">Total</span>
                               <span className="font-bold text-lg">{data.total_amount.toLocaleString()}.-</span>
                           </div>
                       </div>
                       
                       <div className="bg-gray-100 p-4 rounded-xl text-center border border-gray-200">
                           <p className="text-[10px] text-gray-500 mb-3 uppercase tracking-wide font-bold">Scan to Track Status</p>
                           {qrCodeUrl && (
                                <img 
                                    src={qrCodeUrl} 
                                    className="w-32 h-32 mx-auto mix-blend-multiply"
                                    alt="QR"
                                />
                           )}
                       </div>

                       <div className="mt-8 text-center">
                            <p className="text-[10px] text-gray-300 font-mono">
                                Printed: {new Date().toLocaleString()}
                            </p>
                       </div>

                       {/* Bottom Zigzag Pattern */}
                       <div className="absolute bottom-0 left-0 w-full h-4 overflow-hidden" 
                            style={{
                                background: 'linear-gradient(45deg, transparent 33.333%, #ffffff 33.333%, #ffffff 66.667%, transparent 66.667%), linear-gradient(-45deg, transparent 33.333%, #ffffff 33.333%, #ffffff 66.667%, transparent 66.667%)',
                                backgroundSize: '16px 32px',
                                backgroundPosition: '0 16px'
                            }}
                       />
                   </div>
               </div>
          </div>
      </div>
    </>
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
