/* Hallmark · component: HausmadeKeychainPage · theme: Atelier (Dieter Rams + Thai Modern OKLCH)
 * features: Standalone Workshop Atelier, 3D Keychain Playground, Cart Drawer Integration, Admin Mode
 */
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useHausmadeShop } from '../hooks/useHausmadeShop'
import HausmadeKeychainPlayground from '../components/hausmade/HausmadeKeychainPlayground'
import HausmadeCartDrawer from '../components/hausmade/HausmadeCartDrawer'

export default function HausmadeKeychainPage() {
    const shopState = useHausmadeShop()
    const { cartItemCount, totalAmount, addToCart } = shopState
    const [isCartOpen, setIsCartOpen] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)

    // Check if logged in user is admin/staff
    useEffect(() => {
        let isMounted = true
        async function checkRole() {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session?.user) return

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .maybeSingle()

                if (isMounted && profile) {
                    const role = (profile.role || '').toLowerCase()
                    if (['owner', 'admin', 'staff', 'manager'].includes(role)) {
                        setIsAdmin(true)
                    }
                }
            } catch (e) {
                console.warn('Role lookup check error:', e)
            }
        }
        checkRole()
        return () => { isMounted = false }
    }, [])

    const handleCustomAddToCart = (customItem, specs, qty, optPrice, optText) => {
        addToCart(customItem, specs, qty, optPrice, optText)
        setIsCartOpen(true)
    }

    return (
        <div className="min-h-screen bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] flex flex-col antialiased">
            {/* 1. Atelier Top Brutalist Navigation */}
            <nav className="sticky top-0 z-30 bg-[oklch(97%_0.008_28)]/95 backdrop-blur-md border-b border-[oklch(85%_0.012_28)] px-4 sm:px-8 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        to="/hausmade"
                        className="font-mono text-xs font-bold text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] transition-colors px-2.5 py-1 border border-[oklch(85%_0.012_28)] hover:border-[oklch(18%_0.012_28)] bg-[oklch(94%_0.010_28)]"
                    >
                        [ ← HAUSMADE // หน้าร้าน ]
                    </Link>
                    <span className="font-mono text-xs text-[oklch(85%_0.012_28)] hidden sm:inline">/</span>
                    <span className="font-mono text-[11px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider hidden sm:inline">
                        3D PRINT NAME KEYCHAIN ATELIER
                    </span>
                    {isAdmin && (
                        <span className="px-2 py-0.5 bg-[oklch(52%_0.16_28)]/15 border border-[oklch(52%_0.16_28)] text-[oklch(52%_0.16_28)] font-mono text-[10px] font-bold uppercase">
                            [ STAFF MODE: STL/STEP UNLOCKED ]
                        </span>
                    )}
                </div>

                {/* Cart Drawer Trigger Button */}
                <button
                    type="button"
                    onClick={() => setIsCartOpen(true)}
                    className="relative px-3.5 py-1.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-[oklch(52%_0.16_28)] transition-colors font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-2.5 border border-[oklch(18%_0.012_28)] shadow-xs cursor-pointer"
                >
                    <span>[ CART ({cartItemCount}) ]</span>
                    {cartItemCount > 0 && (
                        <span className="border-l border-white/30 pl-2 text-[oklch(88%_0.18_95)]">
                            ฿{totalAmount.toLocaleString()}.-
                        </span>
                    )}
                </button>
            </nav>

            {/* 2. Atelier Sub-Header Banner */}
            <div className="w-full bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] px-4 sm:px-8 py-4">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-mono">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)] uppercase">
                            CUSTOM NAME KEYCHAIN // พวงกุญแจชื่อ 3D PRINT
                        </h1>
                        <p className="text-xs text-[oklch(55%_0.010_28)] mt-0.5">
                            ออกแบบชื่อตัวเอง · ปรับขนาดหูร้อยเชือก 4 mm / 5 mm · สั่งผลิตจริงด้วยระบบ 3D Printing สเปกวิศวกรรม
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[oklch(42%_0.010_28)]">
                        <span className="px-2 py-1 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-bold text-[oklch(52%_0.16_28)]">
                            STARTING: ฿180.- / ชิ้น
                        </span>
                        <span className="px-2 py-1 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)]">
                            MATERIAL: BIO-PLA+
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. Main Playground Canvas Workspace */}
            <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
                <HausmadeKeychainPlayground
                    isAdmin={isAdmin}
                    onAddToCart={handleCustomAddToCart}
                />

                {/* Technical Specifications Guide (Dieter Rams Tabular layout) */}
                <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(99%_0.005_28)] p-6 flex flex-col gap-4 font-mono text-xs">
                    <div className="border-b border-[oklch(85%_0.012_28)] pb-2 flex justify-between items-center">
                        <span className="font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                            [ 3D PRINT SPECIFICATIONS // สเปกการผลิตเชิงวิศวกรรม ]
                        </span>
                        <span className="text-[oklch(55%_0.010_28)] text-[10px]">
                            MANUFACTURED IN NAKHON PHANOM
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex flex-col gap-1.5">
                            <span className="font-bold text-[oklch(52%_0.16_28)]">01 · CORD EYELET (หูร้อยเชือก)</span>
                            <p className="text-[oklch(42%_0.010_28)] leading-relaxed text-[11px]">
                                รูในเจาะตรงสเกล <strong>4.0 mm</strong> หรือ <strong>5.0 mm</strong> ผนังหนา 2.6 mm ไม่ฉีกขาดเมื่อดึงกระชาก เหมาะสำหรับ Paracord, เชือกถัก, หรือห่วงโลหะ
                            </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <span className="font-bold text-[oklch(52%_0.16_28)]">02 · KERNING & WELD (ความแข็งแรง)</span>
                            <p className="text-[oklch(42%_0.010_28)] leading-relaxed text-[11px]">
                                ปรับระยะ Kerning ให้ตัวอักษรเชื่อมซ้อนกันอย่างแน่นหนา พร้อมคานฐาน Underline Rail รองรับสระภาษาไทยและจุดลอย
                            </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <span className="font-bold text-[oklch(52%_0.16_28)]">03 · PRODUCTION (รอบการผลิต)</span>
                            <p className="text-[oklch(42%_0.010_28)] leading-relaxed text-[11px]">
                                พิมพ์ด้วยความละเอียด Layer Height 0.20 mm เส้นใย Bio-based PLA+ เกรดพรีเมียม จัดส่งพัสดุหรือรับหน้าร้านใน 1-2 วันทำการ
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Cart Drawer */}
            <HausmadeCartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                shopState={shopState}
            />
        </div>
    )
}
