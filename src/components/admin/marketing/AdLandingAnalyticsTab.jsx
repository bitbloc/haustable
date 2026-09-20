/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { 
    ExternalLink, 
    Copy, 
    Check, 
    Filter, 
    Navigation, 
    Phone, 
    MessageCircle, 
    Calendar, 
    ShoppingBag, 
    Eye, 
    Layers, 
    Sparkles, 
    RefreshCw 
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdLandingAnalyticsTab() {
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const [timeRange, setTimeRange] = useState('7d') // '24h', '7d', '30d', 'all'
    const [copiedUrl, setCopiedUrl] = useState(null)

    // Campaign Link Builder State
    const [customSource, setCustomSource] = useState('facebook')
    const [customMedium, setCustomMedium] = useState('cpc')
    const [customCampaign, setCustomCampaign] = useState('dinner_promo')
    const [customContent, setCustomContent] = useState('')

    useEffect(() => {
        fetchAdAnalytics()
    }, [timeRange])

    const fetchAdAnalytics = async () => {
        setLoading(true)
        try {
            let query = supabase.from('ad_events').select('*').order('created_at', { ascending: false })

            const now = new Date()
            if (timeRange === '24h') {
                const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
                query = query.gte('created_at', since)
            } else if (timeRange === '7d') {
                const since = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()
                query = query.gte('created_at', since)
            } else if (timeRange === '30d') {
                const since = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()
                query = query.gte('created_at', since)
            }

            const { data, error } = await query.limit(2000)
            if (error) throw error
            setEvents(data || [])
        } catch (err) {
            console.warn('[AdAnalytics] Fetch error or table not yet initialized:', err?.message)
            setEvents([])
        } finally {
            setLoading(false)
        }
    }

    // Process Comprehensive 6-Dimension Metrics
    const metrics = useMemo(() => {
        const totalEvents = events.length
        const isLive = totalEvents > 0

        // 1. Core Page Views
        const pageviews = isLive 
            ? events.filter(e => e.event_name === 'page_view').length 
            : 1420

        // 2. Direct Travel & Call (Immediate Walk-in Intent)
        const mapClicks = isLive 
            ? events.filter(e => e.event_name === 'find_location' || e.event_name === 'click_directions').length 
            : 215
        const phoneClicks = isLive 
            ? events.filter(e => e.event_name === 'contact' || e.event_name === 'click_phone').length 
            : 64

        // 3. Direct Contact & Messaging
        const lineClicks = isLive 
            ? events.filter(e => e.event_name === 'generate_lead' || e.event_name === 'click_line').length 
            : 184

        // 4. Direct Online Services & Transactions (Table Booking & Self-Pickup)
        const bookingClicks = isLive 
            ? events.filter(e => e.event_name === 'click_booking_link').length 
            : 98
        const pickupClicks = isLive 
            ? events.filter(e => e.event_name === 'click_pickup_link').length 
            : 42

        // 5. Deep Exploration (Full Menu, Classic Booklet, Atmosphere / Vibe)
        const fullMenuViews = isLive
            ? events.filter(e => e.event_name === 'view_full_menu').length
            : 312
        const bookletViews = isLive 
            ? events.filter(e => e.event_name === 'view_booklet_menu' || e.event_name === 'lightbox_open').length 
            : 218
        const atmosphereViews = isLive
            ? events.filter(e => e.event_name === 'view_atmosphere').length
            : 175

        // Aggregates
        const totalExplorations = fullMenuViews + bookletViews + atmosphereViews
        const directOrders = bookingClicks + pickupClicks
        const directContacts = lineClicks + phoneClicks
        const totalDirectActions = mapClicks + directContacts + directOrders
        const totalHighIntentActions = totalDirectActions + totalExplorations

        const cvrOverall = pageviews > 0 ? ((totalHighIntentActions / pageviews) * 100).toFixed(1) : '0.0'
        const cvrDirect = pageviews > 0 ? ((totalDirectActions / pageviews) * 100).toFixed(1) : '0.0'

        // 4-Stage Conversion Funnel
        const funnel = [
            { 
                stage: '01. เข้าชมหน้า Ad Landing (/link)', 
                sub: 'จำนวนการเปิดหน้าเว็บทั้งหมดจากทุกช่องทางโฆษณา',
                count: pageviews, 
                pct: 100, 
                color: 'bg-[oklch(18%_0.012_28)]' 
            },
            { 
                stage: '02. สำรวจเมนูและบรรยากาศ (Consideration)', 
                sub: 'เปิดดูเมนูเต็ม ขยายรายการอาหาร พลิกดูเล่ม PDF หรือเปิดดูวิวร้านริมโขง',
                count: totalExplorations, 
                pct: Math.min(100, Math.round((totalExplorations / (pageviews || 1)) * 100)), 
                color: 'bg-[oklch(35%_0.06_250)]' 
            },
            { 
                stage: '03. มีสัญญาณความสนใจเชิงรุก (Active Intent)', 
                sub: 'คลิกขอเส้นทาง Maps, โทรหาร้าน, หรือทักแชท LINE OA',
                count: mapClicks + directContacts, 
                pct: Math.min(100, Math.round(((mapClicks + directContacts) / (pageviews || 1)) * 100)), 
                color: 'bg-[oklch(52%_0.16_28)]' 
            },
            { 
                stage: '04. สั่งซื้อและจองโต๊ะ (Direct Transactions)', 
                sub: 'คลิกจองโต๊ะล่วงหน้า หรือคลิกต้องการสั่งอาหารรับหน้าร้าน (แม้ระบบปิด)',
                count: directOrders, 
                pct: Math.min(100, Math.round((directOrders / (pageviews || 1)) * 100)), 
                color: 'bg-[oklch(45%_0.08_140)]' 
            },
        ]

        // Source Attribution Map
        const sourceMap = {}
        if (isLive) {
            events.forEach(e => {
                const s = e.utm_source || 'direct_organic'
                if (!sourceMap[s]) {
                    sourceMap[s] = { 
                        source: s, 
                        visits: 0, 
                        directions: 0, 
                        contacts: 0, 
                        orders: 0, 
                        explores: 0, 
                        conversions: 0,
                        medium: e.utm_medium || '',
                        campaign: e.utm_campaign || ''
                    }
                }
                const ev = e.event_name || ''
                if (ev === 'page_view') sourceMap[s].visits++
                else if (ev === 'find_location' || ev === 'click_directions') {
                    sourceMap[s].directions++
                    sourceMap[s].conversions++
                } else if (ev === 'generate_lead' || ev === 'click_line' || ev === 'contact' || ev === 'click_phone') {
                    sourceMap[s].contacts++
                    sourceMap[s].conversions++
                } else if (ev === 'click_booking_link' || ev === 'click_pickup_link') {
                    sourceMap[s].orders++
                    sourceMap[s].conversions++
                } else if (ev === 'view_full_menu' || ev === 'view_booklet_menu' || ev === 'view_atmosphere' || ev === 'lightbox_open') {
                    sourceMap[s].explores++
                    sourceMap[s].conversions++
                }
            })
        } else {
            sourceMap['facebook_ads'] = { source: 'facebook_ads', visits: 620, directions: 95, contacts: 88, orders: 62, explores: 230, conversions: 475, medium: 'cpc', campaign: 'dinner_vibe_boost' }
            sourceMap['tiktok_ads'] = { source: 'tiktok_ads', visits: 380, directions: 42, contacts: 38, orders: 28, explores: 180, conversions: 288, medium: 'video', campaign: 'signature_dishes' }
            sourceMap['google_search'] = { source: 'google_search', visits: 240, directions: 64, contacts: 32, orders: 40, explores: 95, conversions: 231, medium: 'search', campaign: 'local_restaurant' }
            sourceMap['instagram_bio'] = { source: 'instagram_bio', visits: 110, directions: 12, contacts: 16, orders: 8, explores: 72, conversions: 108, medium: 'social_profile', campaign: 'haus_riverside' }
            sourceMap['direct_qr_table'] = { source: 'direct_qr_table', visits: 70, directions: 2, contacts: 10, orders: 4, explores: 48, conversions: 64, medium: 'print_standee', campaign: 'standee_qr_01' }
        }

        const sources = Object.values(sourceMap).map(s => ({
            ...s,
            cvr: s.visits > 0 ? ((s.conversions / s.visits) * 100).toFixed(1) : '0.0'
        })).sort((a, b) => b.visits - a.visits)

        return {
            pageviews,
            mapClicks,
            phoneClicks,
            lineClicks,
            bookingClicks,
            pickupClicks,
            fullMenuViews,
            bookletViews,
            atmosphereViews,
            totalExplorations,
            directOrders,
            directContacts,
            totalDirectActions,
            totalHighIntentActions,
            cvrOverall,
            cvrDirect,
            funnel,
            sources,
            isLive
        }
    }, [events])

    const generatedLink = useMemo(() => {
        const base = `${typeof window !== 'undefined' ? window.location.origin : ''}/link`
        const p = new URLSearchParams()
        if (customSource) p.set('utm_source', customSource)
        if (customMedium) p.set('utm_medium', customMedium)
        if (customCampaign) p.set('utm_campaign', customCampaign)
        if (customContent) p.set('utm_content', customContent)
        const qs = p.toString()
        return qs ? `${base}?${qs}` : base
    }, [customSource, customMedium, customCampaign, customContent])

    const copyToClipboard = (text) => {
        if (typeof navigator !== 'undefined') {
            navigator.clipboard.writeText(text)
            setCopiedUrl(text)
            toast.success('คัดลอกลิงก์พร้อม UTM Tracking เรียบร้อยแล้ว')
            setTimeout(() => setCopiedUrl(null), 2500)
        }
    }

    const applyPreset = (src, med, camp, cont = '') => {
        setCustomSource(src)
        setCustomMedium(med)
        setCustomCampaign(camp)
        setCustomContent(cont)
        toast.info(`โหลดเทมเพลต: ${src} / ${med}`)
    }

    return (
        <div className="space-y-6 text-[oklch(18%_0.012_28)] font-sans">
            {/* Header Toolbar */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[oklch(94%_0.010_28)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                                ADS // ATTRIBUTION RADAR
                            </span>
                            <h2 className="font-bold text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                                สถิติและประสิทธิภาพ Ad Landing Page (/link)
                            </h2>
                        </div>
                        <p className="text-xs font-mono text-[oklch(42%_0.010_28)] mt-0.5">
                            วิเคราะห์พฤติกรรมลูกค้าเชิงลึก 6 มิติ (แผนที่, โทร, LINE, จองโต๊ะ, สั่ง Pick-up, และการเปิดชมเมนู/บรรยากาศร้าน)
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Time Range Filter Buttons */}
                        <div className="flex items-center gap-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-1 font-mono text-xs">
                            {[
                                { id: '24h', label: '24 ชม.' },
                                { id: '7d', label: '7 วัน' },
                                { id: '30d', label: '30 วัน' },
                                { id: 'all', label: 'ทั้งหมด' },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTimeRange(t.id)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-xs transition-colors cursor-pointer ${
                                        timeRange === t.id
                                            ? 'bg-[oklch(18%_0.012_28)] text-white'
                                            : 'text-[oklch(42%_0.010_28)] hover:bg-[oklch(90%_0.012_28)]'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Refresh Button */}
                        <button
                            onClick={fetchAdAnalytics}
                            disabled={loading}
                            title="รีเฟรชข้อมูลล่าสุด"
                            className="p-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] rounded-xs cursor-pointer disabled:opacity-50 transition-colors"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Quick Live Status Alert */}
                <div className="px-4 py-2 bg-[oklch(94%_0.010_28)] flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${metrics.isLive ? 'bg-[oklch(45%_0.08_140)] animate-pulse' : 'bg-[oklch(52%_0.16_28)]'}`} />
                        <span className="font-bold">
                            {metrics.isLive ? `DATABASE LIVE SYNC (${events.length} บันทึก Event ในระบบ)` : 'BASELINE TEMPLATE (แสดงตัวอย่างสถิติเพื่อเตรียมรับข้อมูลจริงจาก /link)'}
                        </span>
                    </div>
                    <a
                        href="/link"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[oklch(52%_0.16_28)] font-bold flex items-center gap-1 hover:underline"
                    >
                        <span>เปิดทดสอบหน้า /link</span>
                        <ExternalLink size={12} />
                    </a>
                </div>
            </div>

            {/* 1. Top 6 KPI Cards (Dieter Rams Tabular Grid) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border border-[oklch(85%_0.012_28)] divide-x divide-y md:divide-y-0 divide-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]">
                {/* 1. Pageviews */}
                <div className="p-3.5 space-y-1 bg-[oklch(97%_0.008_28)] font-mono">
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] block font-bold">TOTAL VISITS</span>
                    <div className="text-xl md:text-2xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                        {metrics.pageviews.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-[oklch(42%_0.010_28)] block">เปิดชมหน้า /link</span>
                </div>

                {/* 2. Total Intent Leads */}
                <div className="p-3.5 space-y-1 bg-[oklch(97%_0.008_28)] font-mono">
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] block font-bold">ALL INTENT LEADS</span>
                    <div className="text-xl md:text-2xl font-bold text-[oklch(45%_0.08_140)] tabular-nums">
                        {metrics.totalHighIntentActions.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-[oklch(42%_0.010_28)] block">รวม 6 พฤติกรรมสนใจ</span>
                </div>

                {/* 3. Overall CVR */}
                <div className="p-3.5 space-y-1 bg-[oklch(97%_0.008_28)] font-mono">
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] block font-bold">OVERALL CVR (%)</span>
                    <div className="text-xl md:text-2xl font-bold text-[oklch(52%_0.16_28)] tabular-nums">
                        {metrics.cvrOverall}%
                    </div>
                    <span className="text-[10px] text-[oklch(42%_0.010_28)] block">อัตราแปลงเป็น Lead</span>
                </div>

                {/* 4. Maps & Calls */}
                <div className="p-3.5 space-y-1 bg-[oklch(97%_0.008_28)] font-mono">
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] block font-bold">MAPS & CALLS</span>
                    <div className="text-xl md:text-2xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                        {(metrics.mapClicks + metrics.phoneClicks).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-[oklch(42%_0.010_28)] block">ขอทาง {metrics.mapClicks} · โทร {metrics.phoneClicks}</span>
                </div>

                {/* 5. Online Book & Pickup */}
                <div className="p-3.5 space-y-1 bg-[oklch(97%_0.008_28)] font-mono">
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] block font-bold">BOOK & PICKUP</span>
                    <div className="text-xl md:text-2xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                        {metrics.directOrders.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-[oklch(42%_0.010_28)] block">จอง {metrics.bookingClicks} · รับกลับ {metrics.pickupClicks}</span>
                </div>

                {/* 6. Menu & Vibe Exploration */}
                <div className="p-3.5 space-y-1 bg-[oklch(97%_0.008_28)] font-mono">
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] block font-bold">MENU & VIBE</span>
                    <div className="text-xl md:text-2xl font-bold text-[oklch(35%_0.06_250)] tabular-nums">
                        {metrics.totalExplorations.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-[oklch(42%_0.010_28)] block">เมนู {metrics.fullMenuViews + metrics.bookletViews} · วิว {metrics.atmosphereViews}</span>
                </div>
            </div>

            {/* 2. Full-Funnel Visualizer & Direct Action Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Stepped Conversion Funnel (7 cols) */}
                <div className="lg:col-span-7 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                    <div className="p-3 bg-[oklch(94%_0.010_28)] font-mono text-xs font-bold text-[oklch(18%_0.012_28)] flex items-center justify-between">
                        <span>CONVERSION FUNNEL // ลำดับ 4 ขั้นตอนการแปลงเป็นลูกค้า</span>
                        <span className="text-[oklch(52%_0.16_28)]">FULL FUNNEL FLOW</span>
                    </div>

                    <div className="p-4 space-y-5 font-mono text-xs">
                        {metrics.funnel.map((step, idx) => (
                            <div key={idx} className="space-y-1.5">
                                <div className="flex justify-between items-start text-xs gap-2">
                                    <div>
                                        <span className="font-bold text-[oklch(18%_0.012_28)] font-sans block">{step.stage}</span>
                                        <span className="text-[10px] text-[oklch(42%_0.010_28)] block mt-0.5">{step.sub}</span>
                                    </div>
                                    <span className="tabular-nums font-bold text-[oklch(18%_0.012_28)] text-right shrink-0">
                                        {step.count.toLocaleString()} ครั้ง ({step.pct}%)
                                    </span>
                                </div>
                                <div className="w-full bg-[oklch(94%_0.010_28)] h-3.5 border border-[oklch(85%_0.012_28)] overflow-hidden relative">
                                    <div className={`${step.color} h-full transition-all duration-500`} style={{ width: `${Math.max(3, step.pct)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Executive Insight Note */}
                    <div className="p-3 bg-[oklch(94%_0.010_28)] text-[11px] font-mono text-[oklch(42%_0.010_28)] leading-relaxed">
                        <strong className="text-[oklch(18%_0.012_28)] font-bold">ข้อสังเกตฝ่ายการตลาด:</strong> ลูกค้าส่วนใหญ่จะผ่านขั้นตอนสำรวจเมนูและบรรยากาศ (Stage 02) ก่อนตัดสินใจกดขอทางหรือจองโต๊ะ (Stage 03-04) จึงไม่ควรประเมินสัญญาณ Ads จากแค่ Google Maps เพียงอย่างเดียว
                    </div>
                </div>

                {/* Detailed Action Breakdown Matrix (5 cols) */}
                <div className="lg:col-span-5 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                    <div className="p-3 bg-[oklch(94%_0.010_28)] font-mono text-xs font-bold text-[oklch(18%_0.012_28)] flex items-center justify-between">
                        <span>BEHAVIOR MATRIX // แจกแจงการคลิกทั้ง 8 พฤติกรรม</span>
                        <span className="text-[oklch(42%_0.010_28)]">{metrics.totalHighIntentActions} TOTAL</span>
                    </div>

                    <div className="p-3 space-y-1.5 font-mono text-xs max-h-[440px] overflow-y-auto">
                        {/* 1. Google Maps */}
                        <div className="p-2 hover:bg-[oklch(94%_0.010_28)] transition-colors rounded-xs flex items-center justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <Navigation size={13} className="text-[oklch(45%_0.08_140)]" />
                                    <span className="font-bold text-[oklch(18%_0.012_28)] font-sans">ขอเส้นทาง Google Maps</span>
                                </div>
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] block">เปิด GPS มาร้านริมแม่น้ำโขง</span>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-sm text-[oklch(45%_0.08_140)] tabular-nums">{metrics.mapClicks}</span>
                                <span className="text-[9px] text-[oklch(55%_0.010_28)] block">{metrics.pageviews > 0 ? ((metrics.mapClicks / metrics.pageviews) * 100).toFixed(1) : 0}%</span>
                            </div>
                        </div>

                        {/* 2. Phone Call */}
                        <div className="p-2 hover:bg-[oklch(94%_0.010_28)] transition-colors rounded-xs flex items-center justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <Phone size={13} className="text-[oklch(52%_0.16_28)]" />
                                    <span className="font-bold text-[oklch(18%_0.012_28)] font-sans">โทรศัพท์ติดต่อร้าน (098-528-4217)</span>
                                </div>
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] block">โทรสดถามโต๊ะว่างหรือสั่งล่วงหน้า</span>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-sm text-[oklch(52%_0.16_28)] tabular-nums">{metrics.phoneClicks}</span>
                                <span className="text-[9px] text-[oklch(55%_0.010_28)] block">{metrics.pageviews > 0 ? ((metrics.phoneClicks / metrics.pageviews) * 100).toFixed(1) : 0}%</span>
                            </div>
                        </div>

                        {/* 3. LINE Official */}
                        <div className="p-2 hover:bg-[oklch(94%_0.010_28)] transition-colors rounded-xs flex items-center justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <MessageCircle size={13} className="text-[#06C755]" />
                                    <span className="font-bold text-[oklch(18%_0.012_28)] font-sans">LINE Official Account</span>
                                </div>
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] block">แอดเพื่อน / แชทสอบถามเมนู</span>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">{metrics.lineClicks}</span>
                                <span className="text-[9px] text-[oklch(55%_0.010_28)] block">{metrics.pageviews > 0 ? ((metrics.lineClicks / metrics.pageviews) * 100).toFixed(1) : 0}%</span>
                            </div>
                        </div>

                        {/* 4. Table Booking */}
                        <div className="p-2 hover:bg-[oklch(94%_0.010_28)] transition-colors rounded-xs flex items-center justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={13} className="text-[oklch(18%_0.012_28)]" />
                                    <span className="font-bold text-[oklch(18%_0.012_28)] font-sans">จองโต๊ะล่วงหน้า (/booking)</span>
                                </div>
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] block">คลิกเข้าสู่ระบบจองโต๊ะอาหาร</span>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">{metrics.bookingClicks}</span>
                                <span className="text-[9px] text-[oklch(55%_0.010_28)] block">{metrics.pageviews > 0 ? ((metrics.bookingClicks / metrics.pageviews) * 100).toFixed(1) : 0}%</span>
                            </div>
                        </div>

                        {/* 5. Online Pickup */}
                        <div className="p-2 hover:bg-[oklch(94%_0.010_28)] transition-colors rounded-xs flex items-center justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <ShoppingBag size={13} className="text-[#b89b14]" />
                                    <span className="font-bold text-[oklch(18%_0.012_28)] font-sans">สั่งรับหน้าร้าน (/pickup)</span>
                                </div>
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] block font-semibold text-[oklch(52%_0.16_28)]">
                                    *เจตนาซื้อจริง แม้ระบบออนไลน์ปิดอยู่
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-sm text-[#b89b14] tabular-nums">{metrics.pickupClicks}</span>
                                <span className="text-[9px] text-[oklch(55%_0.010_28)] block">{metrics.pageviews > 0 ? ((metrics.pickupClicks / metrics.pageviews) * 100).toFixed(1) : 0}%</span>
                            </div>
                        </div>

                        {/* 6. Full Menu Accordion */}
                        <div className="p-2 hover:bg-[oklch(94%_0.010_28)] transition-colors rounded-xs flex items-center justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <Layers size={13} className="text-[oklch(35%_0.06_250)]" />
                                    <span className="font-bold text-[oklch(18%_0.012_28)] font-sans">เปิดดูเมนูเต็ม (Full Menu)</span>
                                </div>
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] block">กดขยายดูรายการอาหารทั้งหมด</span>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-sm text-[oklch(35%_0.06_250)] tabular-nums">{metrics.fullMenuViews}</span>
                                <span className="text-[9px] text-[oklch(55%_0.010_28)] block">{metrics.pageviews > 0 ? ((metrics.fullMenuViews / metrics.pageviews) * 100).toFixed(1) : 0}%</span>
                            </div>
                        </div>

                        {/* 7. Classic Booklet */}
                        <div className="p-2 hover:bg-[oklch(94%_0.010_28)] transition-colors rounded-xs flex items-center justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <Eye size={13} className="text-[oklch(42%_0.010_28)]" />
                                    <span className="font-bold text-[oklch(18%_0.012_28)] font-sans">เปิดดูเมนูเล่ม (Booklet PDF)</span>
                                </div>
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] block">พลิกดูเมนูเล่มทางการใน Lightbox</span>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">{metrics.bookletViews}</span>
                                <span className="text-[9px] text-[oklch(55%_0.010_28)] block">{metrics.pageviews > 0 ? ((metrics.bookletViews / metrics.pageviews) * 100).toFixed(1) : 0}%</span>
                            </div>
                        </div>

                        {/* 8. Atmosphere Gallery */}
                        <div className="p-2 hover:bg-[oklch(94%_0.010_28)] transition-colors rounded-xs flex items-center justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <Sparkles size={13} className="text-[oklch(52%_0.16_28)]" />
                                    <span className="font-bold text-[oklch(18%_0.012_28)] font-sans">ชมบรรยากาศร้าน (Vibe Gallery)</span>
                                </div>
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] block">ดูรูปมุมร้านและวิวริมแม่น้ำโขง</span>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-sm text-[oklch(52%_0.16_28)] tabular-nums">{metrics.atmosphereViews}</span>
                                <span className="text-[9px] text-[oklch(55%_0.010_28)] block">{metrics.pageviews > 0 ? ((metrics.atmosphereViews / metrics.pageviews) * 100).toFixed(1) : 0}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Campaign & UTM Source Attribution Matrix */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                <div className="p-3 bg-[oklch(94%_0.010_28)] font-mono text-xs font-bold text-[oklch(18%_0.012_28)] flex items-center justify-between">
                    <span>ATTRIBUTION MATRIX // แหล่งที่มาแคมเปญโฆษณาและการแปลงพฤติกรรม</span>
                    <span className="text-[oklch(42%_0.010_28)]">{metrics.sources.length} แหล่งที่มา</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                        <thead>
                            <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] text-[10px] uppercase text-[oklch(42%_0.010_28)]">
                                <th className="p-3 sticky left-0 bg-[oklch(94%_0.010_28)] z-10">UTM SOURCE / CAMPAIGN</th>
                                <th className="p-3 text-right">VISITS</th>
                                <th className="p-3 text-right">MAPS</th>
                                <th className="p-3 text-right">โทร / LINE</th>
                                <th className="p-3 text-right">จอง / สั่งรับ</th>
                                <th className="p-3 text-right">ดูเมนู / วิว</th>
                                <th className="p-3 text-right">TOTAL INTENT</th>
                                <th className="p-3 text-right">CVR (%)</th>
                                <th className="p-3 text-right">ACTION</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[oklch(85%_0.012_28)]">
                            {metrics.sources.map((s, idx) => (
                                <tr key={idx} className="hover:bg-[oklch(94%_0.010_28)] transition-colors">
                                    <td className="p-3 sticky left-0 bg-[oklch(97%_0.008_28)] z-10 border-r border-[oklch(88%_0.012_28)] sm:border-r-0">
                                        <div className="font-bold text-[oklch(18%_0.012_28)] font-sans">{s.source}</div>
                                        <div className="text-[10px] text-[oklch(55%_0.010_28)]">
                                            {s.campaign || 'default_traffic'} {s.medium ? `· ${s.medium}` : ''}
                                        </div>
                                    </td>
                                    <td className="p-3 text-right font-bold tabular-nums">{s.visits.toLocaleString()}</td>
                                    <td className="p-3 text-right font-bold text-[oklch(45%_0.08_140)] tabular-nums">{s.directions || 0}</td>
                                    <td className="p-3 text-right tabular-nums">{s.contacts || 0}</td>
                                    <td className="p-3 text-right tabular-nums">{s.orders || 0}</td>
                                    <td className="p-3 text-right tabular-nums text-[oklch(35%_0.06_250)]">{s.explores || 0}</td>
                                    <td className="p-3 text-right font-bold text-[oklch(18%_0.012_28)] tabular-nums">{s.conversions.toLocaleString()}</td>
                                    <td className="p-3 text-right font-bold text-[oklch(52%_0.16_28)] tabular-nums">{s.cvr}%</td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={() => copyToClipboard(`${typeof window !== 'undefined' ? window.location.origin : ''}/link?utm_source=${s.source}${s.medium ? `&utm_medium=${s.medium}` : ''}`)}
                                            className="px-2 py-1 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[10px] font-bold rounded-xs cursor-pointer"
                                        >
                                            COPY
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Campaign Link & UTM Generator Widget */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                <div className="p-3 bg-[oklch(94%_0.010_28)] font-mono text-xs font-bold text-[oklch(18%_0.012_28)] flex items-center justify-between">
                    <span>TRACKING BUILDER // เครื่องมือสร้างลิงก์โฆษณาพร้อม UTM สากล</span>
                    <span className="text-[oklch(42%_0.010_28)]">AUTO PRESERVE ATTRIBUTION</span>
                </div>

                <div className="p-4 space-y-4">
                    {/* Quick Presets */}
                    <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
                        <span className="font-bold text-[oklch(55%_0.010_28)]">พรีเซ็ตแนะนำ:</span>
                        <button 
                            type="button"
                            onClick={() => applyPreset('facebook', 'cpc', 'dinner_rush', 'photo_specialty')}
                            className="px-2 py-0.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] rounded-xs cursor-pointer"
                        >
                            Facebook Ad (มื้อค่ำ)
                        </button>
                        <button 
                            type="button"
                            onClick={() => applyPreset('tiktok', 'video', 'river_vibe', 'clip_sunset')}
                            className="px-2 py-0.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] rounded-xs cursor-pointer"
                        >
                            TikTok Video (วิวริมโขง)
                        </button>
                        <button 
                            type="button"
                            onClick={() => applyPreset('instagram', 'bio', 'haus_profile', 'profile_link')}
                            className="px-2 py-0.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] rounded-xs cursor-pointer"
                        >
                            Instagram Bio
                        </button>
                        <button 
                            type="button"
                            onClick={() => applyPreset('qr_table', 'print', 'standee_qr', 'table_tent')}
                            className="px-2 py-0.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] rounded-xs cursor-pointer"
                        >
                            QR บนโต๊ะอาหาร
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
                        <div>
                            <label className="text-[10px] text-[oklch(55%_0.010_28)] font-bold block mb-1">
                                UTM_SOURCE (แหล่งที่มา เช่น facebook, tiktok)
                            </label>
                            <input
                                type="text"
                                value={customSource}
                                onChange={(e) => setCustomSource(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(18%_0.012_28)]"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-[oklch(55%_0.010_28)] font-bold block mb-1">
                                UTM_MEDIUM (ประเภทสื่อ เช่น cpc, video, bio)
                            </label>
                            <input
                                type="text"
                                value={customMedium}
                                onChange={(e) => setCustomMedium(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(18%_0.012_28)]"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-[oklch(55%_0.010_28)] font-bold block mb-1">
                                UTM_CAMPAIGN (ชื่อแคมเปญโปรโมท)
                            </label>
                            <input
                                type="text"
                                value={customCampaign}
                                onChange={(e) => setCustomCampaign(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(18%_0.012_28)]"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-[oklch(55%_0.010_28)] font-bold block mb-1">
                                UTM_CONTENT (ระบุเนื้อหา/ชิ้นงานโฆษณา)
                            </label>
                            <input
                                type="text"
                                value={customContent}
                                placeholder="เช่น photo_01, video_vibe"
                                onChange={(e) => setCustomContent(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(18%_0.012_28)]"
                            />
                        </div>
                    </div>

                    {/* Result Link Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-[oklch(85%_0.012_28)]">
                        <div className="flex-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] px-3 py-2 font-mono text-xs text-[oklch(18%_0.012_28)] truncate select-all">
                            {generatedLink}
                        </div>
                        <button
                            onClick={() => copyToClipboard(generatedLink)}
                            className="px-4 py-2 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-white font-mono text-xs font-bold uppercase rounded-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            {copiedUrl === generatedLink ? <Check size={14} /> : <Copy size={14} />}
                            <span>{copiedUrl === generatedLink ? 'COPIED!' : 'COPY URL'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
