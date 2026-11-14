/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) · slop: pass (1–58) */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { getGeminiApiKey, getGeminiPreferredModel } from '../../../utils/geminiOcrHelper'
import { toast } from 'sonner'

// Helper: Extract Asia/Bangkok hour (0 - 23) reliably & high-performance (UTC+7, no DST)
const getBangkokHour = (timeInput) => {
    if (!timeInput) return -1
    try {
        const d = new Date(timeInput)
        if (isNaN(d.getTime())) return -1
        // Thailand is strictly UTC+7 all year round. Mathematical offset avoids slow Intl instantiation in loops.
        const bkkMs = d.getTime() + (7 * 3600 * 1000)
        return new Date(bkkMs).getUTCHours()
    } catch {
        return new Date(timeInput).getHours()
    }
}

// Helper: Extract Asia/Bangkok date string (YYYY-MM-DD)
const getBangkokDateStr = (timeInput) => {
    if (!timeInput) return ''
    try {
        const d = new Date(timeInput)
        if (isNaN(d.getTime())) return (timeInput || '').split('T')[0]
        const bkkMs = d.getTime() + (7 * 3600 * 1000)
        return new Date(bkkMs).toISOString().slice(0, 10)
    } catch {
        return (timeInput || '').split('T')[0]
    }
}

// 4 Standard Restaurant Dayparts with operational profiles
const DAYPARTS = [
    {
        id: 'lunch',
        label: 'Lunch Rush',
        thaiLabel: 'มื้อกลางวัน',
        hours: [11, 12, 13],
        rangeText: '11:00 - 14:00',
        code: 'DP_01',
        desc: 'อาหารจานเดียว ข้าวหน้าเนื้อ เครื่องดื่ม สปีดบริการเร่งด่วน',
        kitchenPrep: 'เตรียมวัตถุดิบจานด่วน และจัดเตรียมเครื่องดื่ม Takeaway ให้พร้อมบริการก่อน 12.00 น.'
    },
    {
        id: 'afternoon',
        label: 'Afternoon Downtime',
        thaiLabel: 'ช่วงบ่ายคาเฟ่',
        hours: [14, 15, 16],
        rangeText: '14:00 - 17:00',
        code: 'DP_02',
        desc: 'ช่วงคาเฟ่ เบเกอรี่ กาแฟดริป และมุมนั่งพักผ่อนริมโขง',
        kitchenPrep: 'บาร์กาแฟและเครื่องดื่มเป็นแกนหลัก เตรียมเซ็ตโต๊ะ และพักกะพนักงานรอบกลางวัน'
    },
    {
        id: 'dinner',
        label: 'Prime Dinner',
        thaiLabel: 'มื้อค่ำพีค',
        hours: [17, 18, 19, 20],
        rangeText: '17:00 - 21:00',
        code: 'DP_03',
        desc: 'ช่วงรายได้หลักประจำวัน ดินเนอร์ริมโขง ยอดเฉลี่ยต่อบิลสูงสุด',
        kitchenPrep: 'เปิดเต็มทุกสเตชั่นครัวหลัก (เตาย่าง/จานร้อน) สแตนด์บายพนักงานเสิร์ฟและจัดการโต๊ะจอง'
    },
    {
        id: 'late',
        label: 'Late Night Drinks',
        thaiLabel: 'บาร์และดึก',
        hours: [21, 22, 23],
        rangeText: '21:00 - 23:59',
        code: 'DP_04',
        desc: 'บรรยากาศบาร์ ค็อกเทล เบียร์ ไวน์ และของทานเล่นยามค่ำคืน',
        kitchenPrep: 'ลาสออเดอร์อาหารร้อน บาร์ดูแลเครื่องดื่มชิลล์รอบดึกและเช็คสต็อกเตรียมปิดรอบ'
    }
]

// Pre-opening & overnight operational profiles
export const PRE_OPENING_DAYPARTS = {
    overnight: {
        id: 'overnight',
        label: 'Overnight Closed',
        thaiLabel: 'ปิดทำการ',
        hours: [0, 1, 2, 3, 4, 5],
        rangeText: '00:00 - 06:00',
        code: 'DP_CLOSED',
        desc: 'ร้านปิดให้บริการรอบค่ำแล้ว สรุปยอดขายประจำวันและปิดระบบ'
    },
    morning_prep: {
        id: 'morning_prep',
        label: 'Morning Prep',
        thaiLabel: 'เตรียมเปิดร้าน',
        hours: [6, 7, 8, 9, 10],
        rangeText: '06:00 - 11:00',
        code: 'DP_PREP',
        desc: 'ช่วงเตรียมเปิดร้าน ตรวจนับสต็อกวัตถุดิบ เบเกอรี่ และจัดเตรียมโต๊ะจอง'
    }
}

export const getOperatingDaypart = (hour) => {
    if (hour >= 0 && hour < 6) {
        return PRE_OPENING_DAYPARTS.overnight
    }
    if (hour >= 6 && hour < 11) {
        return PRE_OPENING_DAYPARTS.morning_prep
    }
    return DAYPARTS.find(dp => dp.hours.includes(hour)) || DAYPARTS[3]
}

export const getOperatingActionText = (daypartId, paceDeltaPct = 0) => {
    if (daypartId === 'morning_prep') {
        return 'ตรวจเช็คสต็อกวัตถุดิบ & ขนม · ตรวจสอบบุ๊คกิ้งโต๊ะจองประจำวัน · เตรียมพร้อมเปิดร้าน 11.00 น.'
    }
    if (daypartId === 'overnight') {
        return 'ร้านปิดให้บริการรอบค่ำแล้ว · เช็คสรุปยอดขายประจำวันและปิดระบบ'
    }
    if (daypartId === 'lunch') {
        return paceDeltaPct < -10
            ? 'เร่งสปีดบริการจานด่วน & จัดเตรียม Takeaway หน้าร้าน'
            : 'ครัวสแตนด์บายจานด่วนต่อเนื่อง · ดูแลโต๊ะจองรอบบ่าย'
    }
    if (daypartId === 'afternoon') {
        return paceDeltaPct < -10
            ? 'จัดโปรเซ็ตเบเกอรี่คู่เครื่องดื่ม · เช็คยอดจองมื้อค่ำ'
            : 'บาร์ชูเมนูกาแฟดริป & เบเกอรี่ · เช็คเซ็ตติ้งโต๊ะรับรอบดินเนอร์'
    }
    if (daypartId === 'dinner') {
        return paceDeltaPct < -10
            ? 'เปิดรับ Walk-in หน้าบาร์ทันที · นำเสนอ Chef Special'
            : 'ครัวหลักเดินเครื่องเต็มสเตชั่น · สแตนด์บายพนักงานเสิร์ฟรอบพีค'
    }
    return 'เช็คยอดปิดรอบบาร์ · ลาสออเดอร์อาหารร้อน · สแตนด์บายเครื่องดื่มชิลล์'
}

// Parse executive AI strategy briefing into structured sections (supports bracket titles with any characters, markdown bold, and numbered headings)
export const parseBriefingSections = (text) => {
    if (!text || typeof text !== 'string') return { intro: null, sections: [] }

    // 1. Normalize text: remove markdown bold wrapping around bracket headers (e.g. **[1. ...]** -> [1. ...])
    const normalized = text.replace(/\*\*(\[[^\]\r\n]+\])\*\*/g, '$1')

    // 2. Test for bracket section headers (allows ANY characters inside brackets including '(', ')', '&', '/', etc.)
    const hasBracketSections = /(?:^|\n)\s*\[[^\]\r\n]{3,120}\]/.test(normalized)

    let parsedSections = []
    let parsedIntro = null

    if (hasBracketSections) {
        // Split before any bracket header at start of line or string
        const rawParts = normalized
            .split(/(?=(?:^|\n)\s*\[[^\]\r\n]+\])/g)
            .map(s => s.trim())
            .filter(Boolean)

        if (rawParts.length > 0) {
            if (!rawParts[0].startsWith('[')) {
                parsedIntro = rawParts.shift()
            }
            parsedSections = rawParts.map((sec, idx) => {
                const match = sec.match(/^\[([^\]]+)\]\s*([\s\S]*)$/)
                const rawTitle = match ? match[1].trim() : `ประเด็นที่ ${idx + 1}`
                const cleanTitle = rawTitle.replace(/^\[+|\]+$/g, '').trim()
                const content = match ? match[2].trim() : sec.trim()
                return { title: cleanTitle, content }
            })
        }
    }

    // 3. Fallback: Numbered markdown headers (e.g. "### 1. ...", "1. ...", "**1. ...**")
    if (parsedSections.length === 0) {
        const numberedParts = normalized
            .split(/(?=(?:^|\n)\s*(?:###\s*|\*\*\s*|\#\s*)?[1-9]\.\s+)/g)
            .map(s => s.trim())
            .filter(Boolean)

        if (numberedParts.length >= 2) {
            if (!/^(?:###\s*|\*\*\s*|\#\s*)?[1-9]\.\s+/.test(numberedParts[0])) {
                parsedIntro = numberedParts.shift()
            }
            parsedSections = numberedParts.map((sec, idx) => {
                const match = sec.match(/^(?:###\s*|\*\*\s*|\#\s*)?([1-9]\.\s*[^\n\r\*]+)(?:\*\*)?\s*[\r\n]+([\s\S]*)$/)
                const rawTitle = match ? match[1].replace(/^\*\*|\*\*$/g, '').trim() : `ประเด็นที่ ${idx + 1}`
                const cleanTitle = rawTitle.replace(/^\[+|\]+$/g, '').trim()
                const content = match ? match[2].trim() : sec.trim()
                return { title: cleanTitle, content }
            })
        }
    }

    return { intro: parsedIntro, sections: parsedSections }
}

export default function IntradayVelocityDaypartCockpit({
    bookings = [],
    filterMode = 'day', // 'day' | 'month' | 'year'
    selectedDate,
    selectedMonth,
    selectedYear,
    totalSeats = 45,
    loading = false,
    totalExpenses = 0,
    compactMode = false
}) {
    const [hoveredHour, setHoveredHour] = useState(null)
    const [drilldownHour, setDrilldownHour] = useState(null)
    const [activeSubTab, setActiveSubTab] = useState('chart') // 'chart' | 'dayparts' | 'ad_briefing'
    const [monthViewMode, setMonthViewMode] = useState('pacing') // 'pacing' | 'weekday_weekend' | 'dayparts' | 'ranking'
    const [showPredict, setShowPredict] = useState(() => {
        try {
            const saved = localStorage.getItem('intraday_cockpit_show_predict')
            return saved !== null ? JSON.parse(saved) : true
        } catch {
            return true
        }
    })
    const [minimalMode, setMinimalMode] = useState(() => {
        try {
            const saved = localStorage.getItem('intraday_cockpit_minimal_mode')
            if (saved !== null) return JSON.parse(saved)
            if (typeof window !== 'undefined') {
                const isTouchDevice = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
                    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
                    window.innerWidth < 640
                return isTouchDevice
            }
            return false
        } catch {
            return false
        }
    })
    const [adEvents, setAdEvents] = useState([])
    const [aiBriefing, setAiBriefing] = useState(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [copiedBriefing, setCopiedBriefing] = useState(false)
    const containerRef = useRef(null)
    const inspectorRef = useRef(null)
    const chartWrapperRef = useRef(null)
    const chartScrollRef = useRef(null)
    const [containerWidth, setContainerWidth] = useState(800)

    const isTouchDevice = useMemo(() => {
        if (typeof window === 'undefined') return false
        return (
            (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
            /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        )
    }, [])

    // Keyboard ESC and outside pointerdown dismiss for touch/mobile devices
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setDrilldownHour(null)
                setHoveredHour(null)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Dismiss drilldown inspector and stuck hover on outside click / tap safely without freezing WebKit gesture engine
    useEffect(() => {
        if (drilldownHour === null && hoveredHour === null) return
        const handleOutsideClick = (e) => {
            try {
                const target = e.target
                if (!target || !(target instanceof Node)) return
                if (inspectorRef.current && inspectorRef.current.contains(target)) return
                if (chartWrapperRef.current && chartWrapperRef.current.contains(target)) return
                setDrilldownHour(null)
                setHoveredHour(null)
            } catch (err) {
                // Defensive fallback for iOS WebKit SVG node hit-testing
            }
        }
        // Use 'click' and 'touchstart' with passive listener so touch scrolling, pinching and drag gestures are not hijacked on mobile
        document.addEventListener('click', handleOutsideClick, { passive: true })
        document.addEventListener('touchstart', handleOutsideClick, { passive: true })
        return () => {
            document.removeEventListener('click', handleOutsideClick)
            document.removeEventListener('touchstart', handleOutsideClick)
        }
    }, [drilldownHour, hoveredHour])

    // Smooth scroll to drilldown inspector drawer on mobile / iPad when opened
    useEffect(() => {
        if (drilldownHour !== null && inspectorRef.current) {
            const timer = setTimeout(() => {
                if (inspectorRef.current) {
                    const rect = inspectorRef.current.getBoundingClientRect()
                    const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight
                    if (!isVisible) {
                        inspectorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                    }
                }
            }, 60)
            return () => clearTimeout(timer)
        }
    }, [drilldownHour])

    const togglePredict = () => {
        setShowPredict(prev => {
            const next = !prev
            try {
                localStorage.setItem('intraday_cockpit_show_predict', JSON.stringify(next))
            } catch {
                // ignore
            }
            return next
        })
    }

    const toggleMinimalMode = () => {
        setMinimalMode(prev => {
            const next = !prev
            try {
                localStorage.setItem('intraday_cockpit_minimal_mode', JSON.stringify(next))
            } catch {
                // ignore
            }
            return next
        })
    }

    // Operating hours 11:00 to 23:00 (13 slots)
    const hours = useMemo(() => [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], [])

    // Track dynamic inner plot container width for 100% responsive SVG scaling without right-edge clipping
    useEffect(() => {
        const measureInnerWidth = () => {
            if (chartScrollRef.current && chartScrollRef.current.clientWidth > 0) {
                return Math.round(chartScrollRef.current.clientWidth)
            }
            if (containerRef.current) {
                const outerW = containerRef.current.clientWidth || containerRef.current.offsetWidth || 800
                const innerPad = outerW >= 768 ? 48 : 32
                return Math.max(260, Math.round(outerW - innerPad))
            }
            return 0
        }

        let rAF = null
        const updateWidth = () => {
            const w = measureInnerWidth()
            if (w > 0) {
                setContainerWidth(prev => (Math.abs(prev - w) > 4 ? w : prev))
            }
        }
        updateWidth()

        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
            const ro = new ResizeObserver(() => {
                if (rAF) cancelAnimationFrame(rAF)
                rAF = requestAnimationFrame(updateWidth)
            })
            ro.observe(containerRef.current)
            return () => {
                if (rAF) cancelAnimationFrame(rAF)
                ro.disconnect()
            }
        } else {
            window.addEventListener('resize', updateWidth)
            return () => window.removeEventListener('resize', updateWidth)
        }
    }, [activeSubTab, monthViewMode])

    // Determine current date & time in Bangkok timezone
    const todayBangkok = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }), [])
    const isViewingToday = useMemo(() => {
        if (filterMode !== 'day') return false
        if (!selectedDate) return true
        const dStr = String(selectedDate).split('T')[0]
        return dStr === todayBangkok
    }, [filterMode, selectedDate, todayBangkok])

    const targetDateObj = useMemo(() => {
        if (selectedDate) {
            const parts = selectedDate.split('-')
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
        }
        return new Date()
    }, [selectedDate])

    const isWeekend = useMemo(() => {
        const day = targetDateObj.getDay()
        return day === 0 || day === 6
    }, [targetDateObj])

    const dayOfWeekThai = useMemo(() => {
        const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']
        return days[targetDateObj.getDay()]
    }, [targetDateObj])

    const currentBangkokTime = useMemo(() => {
        try {
            const d = new Date()
            const hStr = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour12: false, hour: '2-digit' })
            const mStr = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', minute: '2-digit' })
            return { hour: parseInt(hStr, 10), minute: parseInt(mStr, 10), label: `${hStr}:${mStr}` }
        } catch {
            const d = new Date()
            return {
                hour: d.getHours(),
                minute: d.getMinutes(),
                label: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
            }
        }
    }, [])

    // =========================================================================
    // 1. HISTORICAL BASELINE FETCHING (4 Weeks Same Day-of-Week)
    // =========================================================================
    const [historicalBaseline, setHistoricalBaseline] = useState(() => {
        // Authentic fallback baseline profile for IN THE HAUS (45 seats restaurant/bar)
        const fallbackPax = {
            11: 1, 12: 1, 13: 2, 14: 1, 15: 1, 16: 1,
            17: 3, 18: 4, 19: 4, 20: 3, 21: 2, 22: 1, 23: 0
        }
        const totalP = Object.values(fallbackPax).reduce((a, b) => a + b, 0) // ~23 pax
        const fallbackSales = {}
        const defaultTarget = 7500
        ;[11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].forEach(h => {
            fallbackSales[h] = Math.round((fallbackPax[h] / totalP) * defaultTarget)
        })
        return {
            pax: fallbackPax,
            sales: fallbackSales,
            totalPax: totalP,
            totalSales: defaultTarget
        }
    })

    useEffect(() => {
        let isMounted = true
        async function fetchHistoricalBaseline() {
            const fallbackPax = isWeekend ? {
                11: 2, 12: 3, 13: 3, 14: 2, 15: 2, 16: 2,
                17: 5, 18: 6, 19: 5, 20: 4, 21: 2, 22: 1, 23: 0
            } : {
                11: 1, 12: 1, 13: 2, 14: 1, 15: 1, 16: 1,
                17: 3, 18: 4, 19: 4, 20: 3, 21: 2, 22: 1, 23: 0
            }
            const defaultDayTarget = isWeekend ? 10500 : 7500
            const totalFallbackPax = Object.values(fallbackPax).reduce((a, b) => a + b, 0)
            const fallbackSales = {}
            hours.forEach(h => {
                fallbackSales[h] = Math.round((fallbackPax[h] / totalFallbackPax) * defaultDayTarget)
            })

            try {
                const pastDates = []
                for (let i = 1; i <= 4; i++) {
                    const d = new Date(targetDateObj.getTime() - i * 7 * 24 * 3600 * 1000)
                    pastDates.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }))
                }
                const earliestDate = pastDates[pastDates.length - 1]
                const latestDate = pastDates[0]

                // Query bookings for past 4 weeks (removed total_price to prevent column error)
                const { data, error } = await supabase
                    .from('bookings')
                    .select('id, booking_time, created_at, pax, total_amount, deposit_amount, status')
                    .in('status', ['completed', 'paid', 'success', 'seated', 'confirmed', 'ready'])
                    .gte('booking_time', `${earliestDate}T00:00:00+07:00`)
                    .lte('booking_time', `${latestDate}T23:59:59+07:00`)

                if (error) throw error

                const hourlyPax = {}
                const hourlySales = {}
                hours.forEach(h => { hourlyPax[h] = 0; hourlySales[h] = 0 })
                const daysWithData = new Set()

                ;(data || []).forEach(b => {
                    const t = b.booking_time || b.created_at
                    if (!t) return
                    const dStr = getBangkokDateStr(t)
                    if (pastDates.includes(dStr)) {
                        daysWithData.add(dStr)
                        const h = getBangkokHour(t)
                        if (hourlyPax[h] !== undefined) {
                            const p = parseInt(b.pax || 1, 10)
                            let amt = Number(b.total_amount ?? b.deposit_amount ?? 0)
                            hourlyPax[h] += p
                            hourlySales[h] += amt
                        }
                    }
                })

                const count = daysWithData.size
                if (count > 0) {
                    const avgPax = {}
                    const avgSales = {}
                    let totP = 0
                    let totS = 0
                    hours.forEach(h => {
                        avgPax[h] = Math.max(0, Math.round(hourlyPax[h] / count))
                        avgSales[h] = Math.round(hourlySales[h] / count)
                        totP += avgPax[h]
                        totS += avgSales[h]
                    })
                    if (isMounted) {
                        setHistoricalBaseline({
                            pax: avgPax,
                            sales: avgSales,
                            totalPax: totP || totalFallbackPax,
                            totalSales: totS || defaultDayTarget
                        })
                    }
                } else {
                    if (isMounted) {
                        setHistoricalBaseline({
                            pax: fallbackPax,
                            sales: fallbackSales,
                            totalPax: totalFallbackPax,
                            totalSales: defaultDayTarget
                        })
                    }
                }
            } catch (err) {
                console.warn('[Cockpit] Baseline fallback:', err?.message)
                if (isMounted) {
                    setHistoricalBaseline({
                        pax: fallbackPax,
                        sales: fallbackSales,
                        totalPax: totalFallbackPax,
                        totalSales: defaultDayTarget
                    })
                }
            }
        }

        fetchHistoricalBaseline()
        return () => { isMounted = false }
    }, [targetDateObj, isWeekend, hours])

    // =========================================================================
    // 2. FETCH AD LANDING EVENTS
    // =========================================================================
    useEffect(() => {
        let isMounted = true
        async function fetchAdLandingEvents() {
            try {
                let startIso, endIso
                if (filterMode === 'day') {
                    const queryDay = selectedDate || todayBangkok
                    startIso = `${queryDay}T00:00:00+07:00`
                    endIso = `${queryDay}T23:59:59+07:00`
                } else if (filterMode === 'month') {
                    const m = selectedMonth || todayBangkok.slice(0, 7)
                    const [y, mo] = m.split('-')
                    const lastD = String(new Date(parseInt(y, 10), parseInt(mo, 10), 0).getDate()).padStart(2, '0')
                    startIso = `${m}-01T00:00:00+07:00`
                    endIso = `${m}-${lastD}T23:59:59+07:00`
                } else {
                    const y = selectedYear || String(new Date().getFullYear())
                    startIso = `${y}-01-01T00:00:00+07:00`
                    endIso = `${y}-12-31T23:59:59+07:00`
                }

                const { data, error } = await supabase
                    .from('ad_events')
                    .select('*')
                    .gte('created_at', startIso)
                    .lte('created_at', endIso)
                    .order('created_at', { ascending: true })
                    .limit(2000)

                if (!error && data && isMounted) {
                    setAdEvents(data)
                }
            } catch (err) {
                console.warn('[Cockpit] Ad events fallback:', err?.message)
            }
        }
        fetchAdLandingEvents()

        // Realtime Subscription for Ad Landing Events (Zero Delay)
        const channelName = `cockpit-ad-events-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ad_events' }, () => {
                if (isMounted) {
                    fetchAdLandingEvents()
                }
            })
            .subscribe()

        return () => {
            isMounted = false
            supabase.removeChannel(channel)
        }
    }, [filterMode, selectedDate, selectedMonth, selectedYear, todayBangkok])

    // Reset AI Briefing when date or mode switches to avoid showing cross-date stale analysis
    useEffect(() => {
        setAiBriefing(null)
    }, [selectedDate, selectedMonth, selectedYear, filterMode])

    // Filter valid revenue-generating orders
    const validOrders = useMemo(() => {
        const validStatuses = ['completed', 'paid', 'success', 'seated', 'confirmed', 'ready']
        return (bookings || []).filter(b => {
            const st = (b.status || '').toLowerCase()
            return validStatuses.includes(st) && st !== 'cancelled' && st !== 'void'
        })
    }, [bookings])

    // =========================================================================
    // 3. DAY MODE COMPUTATION (Pacing, Traffic, Dynamic Forecast & Dayparts)
    // =========================================================================
    const dayMetrics = useMemo(() => {
        if (filterMode !== 'day') return null

        const hourlySales = {}
        const hourlyPax = {}
        const hourlyBills = {}
        const hourlyAdDirs = {}
        const hourlyAdInquiries = {}
        const hourlyAdTotal = {}
        const hourlyAdLeads = {}
        hours.forEach(h => {
            hourlySales[h] = 0
            hourlyPax[h] = 0
            hourlyBills[h] = 0
            hourlyAdDirs[h] = 0
            hourlyAdInquiries[h] = 0
            hourlyAdTotal[h] = 0
            hourlyAdLeads[h] = 0
        })

        let totalGross = 0
        let totalGuests = 0

        validOrders.forEach(b => {
            const timeStr = b.booking_time || b.created_at
            if (!timeStr) return
            const h = getBangkokHour(timeStr)

            let billAmt = Number(b.total_amount ?? b.total_price ?? b.deposit_amount ?? 0)
            if (!billAmt && Array.isArray(b.order_items) && b.order_items.length > 0) {
                billAmt = b.order_items.reduce((sum, it) => {
                    const price = Number(it.price_at_time ?? it.menu_items?.price ?? 0)
                    const qty = Number(it.quantity || 1)
                    return sum + (price * qty)
                }, 0)
            }

            const pax = parseInt(b.pax || 1, 10)

            totalGross += billAmt
            totalGuests += pax

            if (hourlySales[h] !== undefined) {
                hourlySales[h] += billAmt
                hourlyPax[h] += pax
                hourlyBills[h] += 1
            }
        })

        let preOpeningAdSignals = 0
        adEvents.forEach(e => {
            const h = getBangkokHour(e.created_at)
            const isDir = ['click_directions', 'find_location', 'directions'].includes(e.event_name)
            const isInq = ['click_phone', 'contact', 'call', 'click_line', 'generate_lead', 'line', 'click_booking_link', 'click_pickup_link', 'booking', 'pickup'].includes(e.event_name)
            const isHighIntent = isDir || isInq

            if (isHighIntent) {
                if (h >= 11 && h <= 23) {
                    if (isDir) hourlyAdDirs[h] = (hourlyAdDirs[h] || 0) + 1
                    if (isInq) hourlyAdInquiries[h] = (hourlyAdInquiries[h] || 0) + 1
                    hourlyAdTotal[h] = (hourlyAdTotal[h] || 0) + 1
                    // Maintain hourlyAdLeads for pacing lift
                    hourlyAdLeads[h] = (hourlyAdLeads[h] || 0) + 1
                } else if (h >= 0 && h < 11) {
                    preOpeningAdSignals += 1
                }
            }
        })

        // Dynamic operational target grounded in the restaurant's actual historical scale
        const baseSalesBenchmark = historicalBaseline.totalSales > 0 
            ? historicalBaseline.totalSales 
            : (isWeekend ? 10500 : 7500)
        // Set realistic target: 15% stretch above day's historical average, or at least current gross
        const targetBenchmark = Math.max(Math.round(baseSalesBenchmark * 1.15 / 100) * 100, Math.round(baseSalesBenchmark))
        const defaultTarget = Math.max(targetBenchmark, Math.round(totalGross / 100) * 100)
        const maxCumulative = Math.max(totalGross * 1.15, defaultTarget)
        const curveWeights = [0.03, 0.08, 0.15, 0.20, 0.25, 0.30, 0.45, 0.65, 0.82, 0.92, 0.97, 0.99, 1.0]
        const benchmarkPoints = hours.map((h, idx) => ({
            hour: h,
            expectedCumulative: Math.round(defaultTarget * (curveWeights[idx] || 1))
        }))

        const cappedHour = isViewingToday ? Math.min(23, Math.max(11, currentBangkokTime.hour)) : 23

        // 1. Pacing Multiplier vs Historical Baseline so far
        let baselineSoFar = 0
        let actualSoFar = 0
        hours.forEach(h => {
            const bVal = historicalBaseline.pax[h] || 0
            if (currentBangkokTime.hour >= 11 && h <= cappedHour) {
                baselineSoFar += bVal
                actualSoFar += (hourlyPax[h] || 0)
            }
        })
        const rawPace = baselineSoFar > 0 ? (actualSoFar / baselineSoFar) : 1.0
        const paceMultiplier = actualSoFar > 0 ? Math.max(0.65, Math.min(1.75, rawPace * 0.75 + 0.25)) : 1.0

        // 2. Near-Term Ad Lift
        const recentHighIntent = hours.reduce((acc, h) => {
            if (h >= cappedHour - 1 && h <= cappedHour) {
                return acc + (hourlyAdLeads[h] || 0)
            }
            return acc
        }, 0)
        const adLiftPct = Math.min(0.35, recentHighIntent * 0.05)

        // Cumulative pacing & dynamic forecast points
        let runningSales = 0
        let runningPax = 0
        let forecastedClosingPax = 0
        let forecastedClosingPaxHigh = 0
        let forecastedClosingPaxLow = 0

        const points = hours.map((h, idx) => {
            const s = hourlySales[h]
            const p = hourlyPax[h]
            runningSales += s
            runningPax += p
            const baseP = historicalBaseline.pax[h] || 0
            const baseS = historicalBaseline.sales[h] || 0
            const spendPerHead = p > 0 ? Math.round(s / p) : 0
            const seatOccupancyPct = Math.round((p / totalSeats) * 100)

            const expectedHourlySales = Math.round(
                defaultTarget * (idx === 0 ? curveWeights[0] : (curveWeights[idx] - curveWeights[idx - 1]))
            )
            const targetSales = Math.max(baseS || 0, expectedHourlySales || 300)
            const targetPax = Math.max(baseP || 0, Math.round(targetSales / 300) || 2)
            const isGoalExceeded = s > 0 && (s >= targetSales || (p >= targetPax && p >= 3))
            const goalDeltaPct = targetSales > 0 ? Math.round(((s - targetSales) / targetSales) * 100) : 0
            const isPaceAhead = runningSales >= (benchmarkPoints[idx]?.expectedCumulative || 0) && runningSales > 0

            const isFuture = isViewingToday ? (currentBangkokTime.hour < 11 ? true : h > cappedHour) : false
            let forecast = null
            let forecastHigh = null
            let forecastLow = null

            if (isFuture) {
                const nearTermLift = (h <= cappedHour + 2) ? (1 + adLiftPct) : 1.0
                forecast = Math.round(baseP * paceMultiplier * nearTermLift)
                forecastHigh = Math.round(baseP * paceMultiplier * (nearTermLift + 0.25))
                forecastLow = Math.max(0, Math.round(baseP * paceMultiplier * Math.max(0.4, nearTermLift - 0.25)))

                forecastedClosingPax += forecast
                forecastedClosingPaxHigh += forecastHigh
                forecastedClosingPaxLow += forecastLow
            } else {
                forecast = p
                forecastHigh = p
                forecastLow = p
                forecastedClosingPax += p
                forecastedClosingPaxHigh += p
                forecastedClosingPaxLow += p
            }

            return {
                hour: h,
                label: `${h}.00`,
                sale: s,
                pax: p,
                baselinePax: baseP,
                baselineSales: baseS,
                targetSales,
                targetPax,
                isGoalExceeded,
                goalDeltaPct,
                isPaceAhead,
                forecast,
                forecastHigh,
                forecastLow,
                isFuture,
                isLifted: isFuture && (h <= cappedHour + 2) && adLiftPct > 0,
                adDirs: hourlyAdDirs[h] || 0,
                adInquiries: hourlyAdInquiries[h] || 0,
                adTotal: hourlyAdTotal[h] || 0,
                adLeads: hourlyAdLeads[h] || 0,
                bills: hourlyBills[h],
                spendPerHead,
                seatOccupancyPct,
                cumulativeSales: runningSales,
                cumulativePax: runningPax,
                benchmarkCumulative: benchmarkPoints[idx]?.expectedCumulative || 0
            }
        })

        // Dayparts breakdown with status, operational guidance, and goal targets
        const daypartBreakdown = DAYPARTS.map(dp => {
            const dpSales = dp.hours.reduce((sum, h) => sum + (hourlySales[h] || 0), 0)
            const dpPax = dp.hours.reduce((sum, h) => sum + (hourlyPax[h] || 0), 0)
            const dpBills = dp.hours.reduce((sum, h) => sum + (hourlyBills[h] || 0), 0)
            const dpBaselinePax = dp.hours.reduce((sum, h) => sum + (historicalBaseline.pax[h] || 0), 0)
            const dpBaselineSales = dp.hours.reduce((sum, h) => sum + (historicalBaseline.sales[h] || 0), 0)

            const dpTargetSales = dp.hours.reduce((sum, h) => {
                const hIdx = hours.indexOf(h)
                const expH = hIdx >= 0 ? Math.round(defaultTarget * (hIdx === 0 ? curveWeights[0] : (curveWeights[hIdx] - curveWeights[hIdx - 1]))) : 0
                return sum + Math.max(historicalBaseline.sales[h] || 0, expH)
            }, 0)
            const isGoalExceeded = dpSales >= dpTargetSales && dpSales > 0
            const goalDeltaPct = dpTargetSales > 0 ? Math.round(((dpSales - dpTargetSales) / dpTargetSales) * 100) : 0

            const pct = totalGross > 0 ? Math.round((dpSales / totalGross) * 1000) / 10 : 0
            const sph = dpPax > 0 ? Math.round(dpSales / dpPax) : 0
            const hourlyRevVelocity = Math.round(dpSales / dp.hours.length)

            let status = 'upcoming'
            if (isViewingToday) {
                const firstHour = dp.hours[0]
                const lastHour = dp.hours[dp.hours.length - 1]
                if (currentBangkokTime.hour > lastHour) {
                    status = 'passed'
                } else if (currentBangkokTime.hour >= firstHour && currentBangkokTime.hour <= lastHour) {
                    status = 'active'
                } else {
                    status = 'upcoming'
                }
            } else {
                status = 'passed'
            }

            return {
                ...dp,
                status,
                sales: dpSales,
                targetSales: dpTargetSales,
                isGoalExceeded,
                goalDeltaPct,
                pax: dpPax,
                baselinePax: dpBaselinePax,
                baselineSales: dpBaselineSales,
                bills: dpBills,
                percent: pct,
                spendPerHead: sph,
                hourlyVelocity: hourlyRevVelocity
            }
        })

        // Peak Velocity Hour
        const peakHourPoint = points.reduce((max, pt) => (pt.sale > (max?.sale || 0) ? pt : max), null)

        // Ad Intent Leads
        const adHighIntent = adEvents.filter(e =>
            ['click_directions', 'find_location', 'directions', 'click_phone', 'contact', 'call', 'click_line', 'generate_lead', 'line', 'click_booking_link', 'click_pickup_link', 'booking', 'pickup'].includes(e.event_name)
        ).length

        // Realistic Projected Closing Sales
        const activePoints = isViewingToday ? points.filter(p => p.hour <= cappedHour) : points
        const latestCumulative = activePoints.length > 0 ? activePoints[activePoints.length - 1].cumulativeSales : 0
        const latestExpected = benchmarkPoints.find(b => b.hour === cappedHour)?.expectedCumulative || 1

        let projectedClosingSales = 0
        if (latestCumulative > 0) {
            const paceRatio = latestCumulative / latestExpected
            projectedClosingSales = Math.round(maxCumulative * paceRatio)
        } else {
            projectedClosingSales = defaultTarget
        }

        const projectedClosingPax = totalGuests > 0 ? forecastedClosingPax : historicalBaseline.totalPax

        const hoursElapsed = isViewingToday
            ? (currentBangkokTime.hour < 11 ? 0 : Math.max(1, (currentBangkokTime.hour - 11) + (currentBangkokTime.minute / 60)))
            : 12
        const currentVelocityPerHour = hoursElapsed > 0 ? Math.round(totalGross / hoursElapsed) : 0
        const pctOfTarget = defaultTarget > 0 ? Math.round((totalGross / defaultTarget) * 100) : 0
        const paceDeltaPct = (isViewingToday && currentBangkokTime.hour < 11)
            ? 0
            : (latestExpected > 0 ? Math.round(((totalGross - latestExpected) / latestExpected) * 1000) / 10 : 0)

        const adDirs = adEvents.filter(e => ['click_directions', 'find_location', 'directions'].includes(e.event_name)).length
        const adCalls = adEvents.filter(e => ['click_phone', 'contact', 'call'].includes(e.event_name)).length
        const adBookings = adEvents.filter(e => ['click_booking_link', 'click_pickup_link', 'booking', 'pickup', 'generate_lead', 'click_line', 'line'].includes(e.event_name)).length

        const goalExceededHoursCount = points.filter(p => p.isGoalExceeded).length
        const isDailyGoalExceeded = totalGross >= defaultTarget && totalGross > 0
        const dailyGoalDeltaPct = defaultTarget > 0 ? Math.round(((totalGross - defaultTarget) / defaultTarget) * 100) : 0

        return {
            totalGross,
            totalGuests,
            points,
            activePoints,
            benchmarkPoints,
            daypartBreakdown,
            peakHourPoint,
            adHighIntent,
            defaultTarget,
            projectedClosingSales,
            projectedClosingPax,
            forecastedClosingPaxHigh,
            forecastedClosingPaxLow,
            cappedHour,
            paceMultiplier,
            baselinePaxSoFar: baselineSoFar,
            latestExpected,
            currentVelocityPerHour,
            hoursElapsed,
            pctOfTarget,
            paceDeltaPct,
            adDirs,
            adCalls,
            adBookings,
            preOpeningAdSignals,
            goalExceededHoursCount,
            isDailyGoalExceeded,
            dailyGoalDeltaPct,
            adLiftPct
        }
    }, [filterMode, validOrders, hours, totalSeats, adEvents, isViewingToday, currentBangkokTime, isWeekend, historicalBaseline])

    // =========================================================================
    // 4. MONTH MODE COMPUTATION
    // =========================================================================
    const monthMetrics = useMemo(() => {
        if (filterMode !== 'month') return null

        const dateMap = {}
        const mStr = selectedMonth || todayBangkok.slice(0, 7)
        const [y, mo] = mStr.split('-')
        const totalDaysInMonth = new Date(parseInt(y, 10), parseInt(mo, 10), 0).getDate()

        for (let d = 1; d <= totalDaysInMonth; d++) {
            const dateStr = `${mStr}-${String(d).padStart(2, '0')}`
            const dObj = new Date(`${dateStr}T12:00:00+07:00`)
            const dayOfWeek = dObj.getDay()
            const isWknd = dayOfWeek === 0 || dayOfWeek === 6

            const hSales = {}
            const hPax = {}
            const hBills = {}
            hours.forEach(h => { hSales[h] = 0; hPax[h] = 0; hBills[h] = 0 })

            dateMap[dateStr] = {
                date: dateStr,
                dayNumber: d,
                dayOfWeek,
                isWeekend: isWknd,
                sales: 0,
                pax: 0,
                bills: 0,
                hourlySales: hSales,
                hourlyPax: hPax,
                hourlyBills: hBills
            }
        }

        let monthGross = 0
        let monthPax = 0
        let monthBills = 0

        validOrders.forEach(b => {
            const t = b.booking_time || b.created_at
            if (!t) return
            const dateStr = getBangkokDateStr(t)
            if (!dateMap[dateStr]) return

            let billAmt = Number(b.total_amount ?? b.total_price ?? b.deposit_amount ?? 0)
            if (!billAmt && Array.isArray(b.order_items) && b.order_items.length > 0) {
                billAmt = b.order_items.reduce((sum, it) => {
                    const price = Number(it.price_at_time ?? it.menu_items?.price ?? 0)
                    const qty = Number(it.quantity || 1)
                    return sum + (price * qty)
                }, 0)
            }
            const pax = parseInt(b.pax || 1, 10)
            const h = getBangkokHour(t)

            monthGross += billAmt
            monthPax += pax
            monthBills += 1

            dateMap[dateStr].sales += billAmt
            dateMap[dateStr].pax += pax
            dateMap[dateStr].bills += 1

            if (dateMap[dateStr].hourlySales[h] !== undefined) {
                dateMap[dateStr].hourlySales[h] += billAmt
                dateMap[dateStr].hourlyPax[h] += pax
                dateMap[dateStr].hourlyBills[h] = (dateMap[dateStr].hourlyBills[h] || 0) + 1
            }
        })

        const daysList = Object.values(dateMap)
        const daysWithSales = daysList.filter(d => d.sales > 0)
        const activeDaysCount = Math.max(1, daysWithSales.length)

        // Average Hourly Profile
        let runningMonthSales = 0
        let runningMonthPax = 0
        const monthlyAvgHourly = hours.map(h => {
            const totalHourSales = daysList.reduce((sum, d) => sum + (d.hourlySales[h] || 0), 0)
            const totalHourPax = daysList.reduce((sum, d) => sum + (d.hourlyPax[h] || 0), 0)
            const totalHourBills = daysList.reduce((sum, d) => sum + (d.hourlyBills?.[h] || 0), 0)
            const avgSales = Math.round(totalHourSales / activeDaysCount)
            const avgPax = Math.round((totalHourPax / activeDaysCount) * 10) / 10
            const avgBills = Math.round((totalHourBills / activeDaysCount) * 10) / 10
            runningMonthSales += totalHourSales
            runningMonthPax += totalHourPax

            return {
                hour: h,
                label: `${h}.00`,
                totalSales: totalHourSales,
                totalPax: totalHourPax,
                totalBills: totalHourBills,
                avgSales,
                avgPax,
                avgBills,
                sale: totalHourSales,
                pax: totalHourPax,
                bills: totalHourBills,
                spendPerHead: totalHourPax > 0 ? Math.round(totalHourSales / totalHourPax) : 0,
                occupancyPct: Math.round((avgPax / totalSeats) * 100),
                seatOccupancyPct: Math.round((avgPax / totalSeats) * 100),
                cumulativeSales: runningMonthSales,
                cumulativePax: runningMonthPax
            }
        })

        // Monthly Master Cumulative Pacing Curve
        let cumulAvg = 0
        const monthlyMasterPacing = monthlyAvgHourly.map(pt => {
            cumulAvg += pt.avgSales
            return {
                ...pt,
                cumulativeAvgSales: cumulAvg
            }
        })

        // Weekdays vs Weekends Curves
        const weekdayDays = daysList.filter(d => !d.isWeekend && d.sales > 0)
        const weekendDays = daysList.filter(d => d.isWeekend && d.sales > 0)
        const weekdayCount = Math.max(1, weekdayDays.length)
        const weekendCount = Math.max(1, weekendDays.length)

        let runningWeekdayCumul = 0
        let runningWeekendCumul = 0

        const weekdayWeekendCurve = hours.map(h => {
            const weekdayHourSales = weekdayDays.reduce((sum, d) => sum + (d.hourlySales[h] || 0), 0)
            const weekendHourSales = weekendDays.reduce((sum, d) => sum + (d.hourlySales[h] || 0), 0)

            const weekdayAvg = Math.round(weekdayHourSales / weekdayCount)
            const weekendAvg = Math.round(weekendHourSales / weekendCount)

            runningWeekdayCumul += weekdayAvg
            runningWeekendCumul += weekendAvg

            return {
                hour: h,
                label: `${h}.00`,
                weekdayAvg,
                weekendAvg,
                weekdayCumulative: runningWeekdayCumul,
                weekendCumulative: runningWeekendCumul
            }
        })

        // Monthly 4 Dayparts Summary
        const monthlyDayparts = DAYPARTS.map(dp => {
            let dpSales = 0
            let dpPax = 0
            let dpBills = 0
            dp.hours.forEach(h => {
                dpSales += daysList.reduce((sum, d) => sum + (d.hourlySales[h] || 0), 0)
                dpPax += daysList.reduce((sum, d) => sum + (d.hourlyPax[h] || 0), 0)
                dpBills += daysList.reduce((sum, d) => sum + (d.hourlyBills?.[h] || 0), 0)
            })

            const pct = monthGross > 0 ? Math.round((dpSales / monthGross) * 1000) / 10 : 0
            const sph = dpPax > 0 ? Math.round(dpSales / dpPax) : 0
            const totalOpHours = dp.hours.length * activeDaysCount
            const hourlyVelocity = totalOpHours > 0 ? Math.round(dpSales / totalOpHours) : 0

            return {
                ...dp,
                sales: dpSales,
                pax: dpPax,
                bills: dpBills,
                percent: pct,
                spendPerHead: sph,
                hourlyVelocity
            }
        })

        // Daily Velocity Ranking
        const rankedDays = [...daysWithSales].sort((a, b) => b.sales - a.sales)
        const topDays = rankedDays.slice(0, 5)
        const slowDays = [...daysWithSales].sort((a, b) => a.sales - b.sales).slice(0, 3)

        // Break-Even Hour
        const dailyExpenseTarget = totalExpenses > 0 ? Math.round(totalExpenses / activeDaysCount) : 15000
        const breakEvenPoint = monthlyMasterPacing.find(p => p.cumulativeAvgSales >= dailyExpenseTarget)

        return {
            monthGross,
            monthPax,
            monthBills,
            activeDaysCount,
            totalDaysInMonth,
            monthlyAvgHourly,
            monthlyMasterPacing,
            weekdayWeekendCurve,
            monthlyDayparts,
            topDays,
            slowDays,
            dailyExpenseTarget,
            breakEvenHour: breakEvenPoint ? `${breakEvenPoint.hour}.00 น.` : 'เกิน 23.00 น.'
        }
    }, [filterMode, validOrders, hours, totalSeats, totalExpenses, selectedMonth, todayBangkok])

    // Memoize Drill-down Data for Selected Hour (Supports both Day and Month modes)
    const { drillHourData, drillHourOrders, drillTopItems } = useMemo(() => {
        const pointsList = filterMode === 'month' ? monthMetrics?.monthlyAvgHourly : dayMetrics?.points
        if (drilldownHour === null || !pointsList) {
            return { drillHourData: null, drillHourOrders: [], drillTopItems: [] }
        }
        const pt = pointsList.find(p => p.hour === drilldownHour)
        const orders = (validOrders || []).filter(b => {
            const t = b.booking_time || b.created_at
            return getBangkokHour(t) === drilldownHour
        })

        const itemMap = {}
        orders.forEach(b => {
            const items = Array.isArray(b.order_items) ? b.order_items : []
            items.forEach(it => {
                const name = it.name || it.item_name || it.menu_items?.name_th || it.menu_items?.name || 'รายการทั่วไป'
                const qty = Number(it.quantity || 1)
                const price = Number(it.price_at_time ?? it.menu_items?.price ?? 0)
                if (!itemMap[name]) itemMap[name] = { name, qty: 0, total: 0 }
                itemMap[name].qty += qty
                itemMap[name].total += price * qty
            })
        })
        const topItems = Object.values(itemMap).sort((a, b) => b.total - a.total).slice(0, 4)

        return { drillHourData: pt, drillHourOrders: orders, drillTopItems: topItems }
    }, [drilldownHour, filterMode, dayMetrics, monthMetrics, validOrders])

    // =========================================================================
    // 5. ON-DEMAND AI BRIEFING GENERATION
    // =========================================================================
    const generateAiBriefing = async () => {
        setAiLoading(true)
        try {
            const apiKey = await getGeminiApiKey()
            const preferredModel = await getGeminiPreferredModel() || 'gemini-4-argon'

            if (!apiKey) {
                toast.error('กรุณาตั้งค่า Gemini API Key ในระบบก่อนใช้งาน')
                setAiLoading(false)
                return
            }

            // Extract detailed Ad & Search Intent intelligence
            const adMapsCount = adEvents.filter(e => ['click_directions', 'find_location', 'directions'].includes(e.event_name)).length
            const adContactCount = adEvents.filter(e => ['click_phone', 'contact', 'call', 'click_line', 'generate_lead', 'line'].includes(e.event_name)).length
            const adBookingCount = adEvents.filter(e => ['click_booking_link', 'click_pickup_link', 'booking', 'pickup'].includes(e.event_name)).length
            const adMenuCount = adEvents.filter(e => ['view_menu', 'explore_menu', 'view_vibe', 'view_full_menu', 'view_booklet_menu', 'click_booklet', 'view_atmosphere', 'lightbox_open'].includes(e.event_name)).length
            const adTotalEvents = adEvents.length
            
            const adSourceMap = {}
            adEvents.forEach(e => {
                const src = e.utm_source || 'Direct / ไม่ระบุ'
                adSourceMap[src] = (adSourceMap[src] || 0) + 1
            })
            const adSourceSummary = Object.entries(adSourceMap)
                .map(([src, count]) => `${src} (${count})`)
                .join(', ') || 'ไม่มีข้อมูลช่องทาง'

            let promptContext = ''
            if (filterMode === 'month') {
                promptContext = `
คุณคือผู้อำนวยการฝ่ายการเงินและยุทธศาสตร์ร้านอาหาร "IN THE HAUS" 
จงวิเคราะห์ภาพรวมผลการดำเนินงาน สถิติความเร็วรายชั่วโมง (Hourly Velocity) และข้อมูล Ad Attribution ประจำเดือน ${selectedMonth || todayBangkok.slice(0, 7)}:
- ข้อมูลบริบทของร้าน: ร้านอาหารและบาร์ริมแม่น้ำโขง จังหวัดนครพนม ความจุร้าน 45 ที่นั่ง
- ยอดขายรวมทั้งเดือน: ฿${monthMetrics?.monthGross?.toLocaleString() || 0}
- จำนวนลูกค้าสะสม: ${monthMetrics?.monthPax?.toLocaleString() || 0} ท่าน (เฉลี่ย ฿${monthMetrics?.monthPax > 0 ? Math.round(monthMetrics.monthGross / monthMetrics.monthPax) : 0}/หัว)
- ชั่วโมงคุ้มทุนรายวันเฉลี่ย: ${monthMetrics?.breakEvenHour || '-'} (เป้าหมาย ฿${monthMetrics?.dailyExpenseTarget?.toLocaleString() || 0})
- สัดส่วน 4 Dayparts:
${monthMetrics?.monthlyDayparts?.map(dp => `  * ${dp.label} (${dp.rangeText}): ฿${dp.sales.toLocaleString()} (${dp.percent}%) ลูกค้า ${dp.pax} ท่าน ความเร็ว ฿${dp.hourlyVelocity.toLocaleString()}/ชม.`).join('\n') || '-'}
- สรุปสัญญาณแคมเปญออนไลน์ (Ad Attribution): รวม ${adTotalEvents} ปฏิสัมพันธ์ (ขอเส้นทาง Maps: ${adMapsCount}, โทร/LINE: ${adContactCount}, จอง/สั่งกลับ: ${adBookingCount}, สำรวจเมนู/วิวริมโขง: ${adMenuCount}, ช่องทางหลัก: ${adSourceSummary})
`
            } else {
                promptContext = `
คุณคือผู้จัดการกะและผู้อำนวยการปฏิบัติการร้านอาหาร "IN THE HAUS"
จงวิเคราะห์สถานการณ์ความเร็วยอดขาย ทราฟฟิกลูกค้า (Intraday Velocity & Traffic) และเจาะลึกสัญญาณ Ad Intent Leads ประจำวัน ${dayOfWeekThai} (${selectedDate || todayBangkok}):
- ข้อมูลบริบทของร้าน: ร้านอาหารและบาร์ริมแม่น้ำโขง จังหวัดนครพนม ความจุร้าน 45 ที่นั่ง
- ยอดขายสะสมขณะนี้: ฿${dayMetrics?.totalGross?.toLocaleString() || 0} จากเป้าหมายประจำวัน ฿${dayMetrics?.defaultTarget?.toLocaleString() || 0} (เฉลี่ยสถิติวัน${dayOfWeekThai}ปกติ ~฿${historicalBaseline?.totalSales?.toLocaleString() || 0})
- ลูกค้าเข้าจริงสะสม: ${dayMetrics?.totalGuests || 0} ท่าน (เฉลี่ยสถิติปกติวัน${dayOfWeekThai}: ~${historicalBaseline?.totalPax || 0} ท่าน, คาดการณ์ปิดวัน: ~${dayMetrics?.projectedClosingPax || 0} ท่าน)
- สถิติแยก 4 Dayparts:
${dayMetrics?.daypartBreakdown?.map(dp => `  * ${dp.label} [${dp.status?.toUpperCase()}]: ยอด ฿${dp.sales?.toLocaleString() || 0} ลูกค้าจริง ${dp.pax || 0} ท่าน (สถิติปกติ ~${dp.baselinePax || 0} ท่าน)`).join('\n') || '-'}
- สัญญาณความสนใจจากแคมเปญออนไลน์ (Ad & Search Intent Leads): รวม ${adTotalEvents} ปฏิสัมพันธ์ (${dayMetrics?.adHighIntent || 0} High-Intent Leads)
  * ขอเส้นทาง Google Maps (สัญญาณลูกค้าน่าจะกำลังเดินทางมา): ${adMapsCount} ครั้ง
  * โทรศัพท์ / ทัก LINE Official (สอบถามโต๊ะ/สั่งอาหารล่วงหน้า): ${adContactCount} ครั้ง
  * จองโต๊ะ / สั่งกลับบ้านผ่านลิงก์: ${adBookingCount} ครั้ง
  * สำรวจเมนูอาหาร / ดูภาพบรรยากาศริมโขง: ${adMenuCount} ครั้ง
  * ช่องทางแคมเปญที่มา (UTM Sources): ${adSourceSummary}
`
            }

            const promptText = `${promptContext}
ให้เขียนบทวิเคราะห์เชิงยุทธศาสตร์ที่เฉียบคม สุภาพ และปฏิบัติได้จริงเป็นภาษาไทย โดยแบ่งเนื้อหาออกเป็น 3 หมวดหมู่ชัดเจน:
[1. การวิเคราะห์ความเร็วยอดขายและการครองที่นั่ง]
- ประเมินยอดขายสะสมและจำนวนลูกค้าจริงเทียบกับสถิติตามจริงของวัน${dayOfWeekThai} (~฿${historicalBaseline?.totalSales?.toLocaleString()} / ~${historicalBaseline?.totalPax} ท่าน)
- วิเคราะห์การครองที่นั่งของแต่ละ Daypart อย่างเป็นธรรม (เข้าใจธรรมชาติร้านริมน้ำที่ยอดรายได้หลักจะเข้าช่วง Prime Dinner 17.00-21.00 น.)

[2. วิเคราะห์สัญญาณออนไลน์และการเชื่อมโยงสู่ยอดขาย (Ad & Customer Intent)]
- วิเคราะห์เจาะลึกสัญญาณ Ad Intent Leads ทั้ง 4 มิติ (ขอเส้นทาง ${adMapsCount}, โทร/LINE ${adContactCount}, จอง/สั่งกลับ ${adBookingCount}, สำรวจเมนู ${adMenuCount}) ว่าสะท้อนถึงลูกค้าประเภทใด
- อธิบายการเชื่อมโยงสู่หน้าร้านจริง เช่น หากมีการขอทาง/โทร บ่งชี้กลุ่ม Walk-in หรือนัดหมายโต๊ะวิวริมโขง และให้คำแนะนำการตลาดว่าควรดันคอนเทนต์ภาพวิวริมโขงหรือเมนูเด็ดช่วงเวลาใด

[3. คำแนะนำเชิงปฏิบัติการและยุทธวิธีผลักดันยอดสู่เป้าหมาย]
- คำแนะนำรูปธรรมสำหรับทีมหน้าร้าน ครัว และบาร์ เพื่อรับมือช่วงเวลาที่เหลือของวัน
- ยุทธวิธีจัดสรรโต๊ะริมน้ำ การดันเครื่องดื่ม/เมนูสร้างกำไร เพื่อผลักดันยอดปิดวันให้ถึงเป้าหมายประจำวัน ฿${dayMetrics?.defaultTarget?.toLocaleString()}

ข้อกำหนดสำคัญ:
- ต้องตอบให้ครบถ้วนทั้ง 3 หมวดหมู่ข้างต้นและเขียนสรุปให้จบสมบูรณ์ ห้ามตัดจบกลางคัน
- ห้ามใช้เครื่องหมายดอกจัน (ห้ามใส่ **) ในการตกแต่งข้อความ ให้ใช้ข้อความที่อ่านง่าย สะอาดตา
- ความยาวเนื้อหาประมาณ 240-360 คำ`

            const candidateModels = [
                preferredModel,
                'gemini-4-argon',
                'gemini-3.7-flash',
                'gemini-2.5-flash',
                'gemini-2.0-flash',
                'gemini-1.5-flash'
            ].filter((v, i, a) => v && a.indexOf(v) === i)

            let textOutput = null
            let lastError = null

            for (const model of candidateModels) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: promptText }] }],
                            generationConfig: { maxOutputTokens: 8192, temperature: 0.3 }
                        })
                    })

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}))
                        const errMsg = errData?.error?.message || response.statusText
                        if (response.status === 404 || errMsg.toLowerCase().includes('not found')) {
                            lastError = new Error(`[${model}] ${errMsg}`)
                            continue
                        }
                        throw new Error(errMsg)
                    }

                    const result = await response.json()
                    textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text
                    if (textOutput) break
                } catch (e) {
                    lastError = e
                }
            }

            if (textOutput) {
                setAiBriefing(textOutput)
                toast.success('วิเคราะห์บทวิเคราะห์กลยุทธ์เรียบร้อยแล้ว')
            } else {
                throw lastError || new Error('No text generated')
            }
        } catch (err) {
            console.error('AI Briefing error:', err)
            toast.error('ไม่สามารถเรียก AI วิเคราะห์ได้: ' + (err.message || 'เครือข่ายขัดข้อง'))
        } finally {
            setAiLoading(false)
        }
    }

    const copyBriefingToClipboard = async () => {
        if (!aiBriefing) return
        const cleanText = aiBriefing.replace(/\*\*/g, '')
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(cleanText)
            } else {
                // Fallback for older/restricted mobile browsers
                const textArea = document.createElement('textarea')
                textArea.value = cleanText
                textArea.style.position = 'fixed'
                textArea.style.left = '-999999px'
                textArea.style.top = '-999999px'
                document.body.appendChild(textArea)
                textArea.focus()
                textArea.select()
                document.execCommand('copy')
                document.body.removeChild(textArea)
            }
            setCopiedBriefing(true)
            toast.success('คัดลอกบทวิเคราะห์กลยุทธ์แล้ว')
            setTimeout(() => setCopiedBriefing(false), 2000)
        } catch (err) {
            console.warn('Copy briefing failed:', err)
            toast.error('ไม่สามารถคัดลอกได้อัตโนมัติ')
        }
    }

    const renderBriefingContent = (text) => {
        if (!text) return null

        const renderInline = (line, key) => {
            const parts = line.split(/(\*\*.*?\*\*)/g)
            return (
                <span key={key}>
                    {parts.map((part, pIdx) => {
                        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                            return (
                                <strong key={pIdx} className="font-bold text-[oklch(18%_0.012_28)]">
                                    {part.slice(2, -2)}
                                </strong>
                            )
                        }
                        return part
                    })}
                </span>
            )
        }

        const { intro: parsedIntro, sections: parsedSections } = parseBriefingSections(text)

        // Render multi-card grid if sections were parsed
        if (parsedSections.length > 0) {
            const gridColsClass = parsedSections.length === 2 
                ? 'grid-cols-1 md:grid-cols-2' 
                : parsedSections.length === 4
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-3'

            return (
                <div className="space-y-3">
                    {parsedIntro && (
                        <div className="p-3 bg-[oklch(96%_0.010_28)] border border-[oklch(85%_0.012_28)] text-xs text-[oklch(18%_0.012_28)] font-medium leading-relaxed">
                            {parsedIntro.split('\n').map((line, idx) => (
                                <p key={idx}>{renderInline(line, idx)}</p>
                            ))}
                        </div>
                    )}
                    <div className={`grid ${gridColsClass} gap-3 items-stretch`}>
                        {parsedSections.map((sec, idx) => {
                            const lines = sec.content.split('\n').map(l => l.trim()).filter(Boolean)
                            return (
                                <div 
                                    key={idx} 
                                    className="p-4 bg-[oklch(97%_0.008_28)] border border-[oklch(88%_0.012_28)] rounded-xl flex flex-col justify-between transition-colors hover:border-[oklch(75%_0.012_28)]"
                                >
                                    <div>
                                        <div className="font-semibold text-xs text-[oklch(18%_0.012_28)] border-b border-[oklch(88%_0.012_28)] pb-2 mb-2.5 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(52%_0.16_28)] shrink-0" />
                                            <span className="truncate">{sec.title}</span>
                                        </div>
                                        <div className="text-xs text-[oklch(28%_0.012_28)] leading-relaxed space-y-2">
                                            {lines.map((line, lIdx) => {
                                                const isBullet = /^[-*•]\s+/.test(line)
                                                if (isBullet) {
                                                    const cleanBulletText = line.replace(/^[-*•]\s+/, '')
                                                    return (
                                                        <div key={lIdx} className="flex items-start gap-2 leading-relaxed">
                                                            <span className="w-1 h-1 rounded-full bg-[oklch(52%_0.16_28)] mt-2 shrink-0 select-none" />
                                                            <span className="flex-1">{renderInline(cleanBulletText, lIdx)}</span>
                                                        </div>
                                                    )
                                                }
                                                return (
                                                    <p key={lIdx} className="leading-relaxed">
                                                        {renderInline(line, lIdx)}
                                                    </p>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )
        }

        // Fallback for unformatted raw text
        return (
            <div className="text-xs text-[oklch(18%_0.012_28)] leading-relaxed font-sans bg-[oklch(94%_0.010_28)] p-4 border border-[oklch(85%_0.012_28)] space-y-1.5">
                {text.split('\n').map((line, idx) => {
                    const trimmed = line.trim()
                    if (!trimmed) return <div key={idx} className="h-1" />
                    return (
                        <p key={idx} className="leading-relaxed">
                            {renderInline(trimmed, idx)}
                        </p>
                    )
                })}
            </div>
        )
    }

    // =========================================================================
    // 6. SVG RENDER DIMENSIONS & DUAL-LAYER PROJECTION ENGINE
    // =========================================================================
    const isMobile = containerWidth < 560
    // Fit exact inner scroll width on desktop (prevents 23:00 clipping), minimum 540px on mobile pan
    const svgWidth = isMobile ? Math.max(540, containerWidth) : Math.max(560, containerWidth)
    const svgHeight = isMobile ? 268 : 292
    const padLeft = isMobile ? 38 : 48
    const padRight = isMobile ? 40 : 46 // Clean right margin reserved strictly for Pax axis labels
    const padYTop = isMobile ? 46 : 46   // Dedicated two-tier headroom prevents NOW pill overlapping dayparts
    const padYBottom = isMobile ? 34 : 36
    const plotWidth = Math.max(svgWidth - padLeft - padRight, 200)
    const plotHeight = Math.max(svgHeight - padYTop - padYBottom, 120)

    // Auto-scroll horizontal chart canvas to current hour on mobile
    useEffect(() => {
        if (isMobile && chartScrollRef.current && isViewingToday && currentBangkokTime.hour >= 11) {
            const fraction = (currentBangkokTime.hour - 11) / 12
            const targetScroll = Math.max(0, fraction * (svgWidth - containerWidth) - 40)
            chartScrollRef.current.scrollLeft = targetScroll
        }
    }, [isMobile, isViewingToday, currentBangkokTime.hour, svgWidth, containerWidth])

    const getX = (hour) => {
        const idx = hours.indexOf(hour)
        if (idx === -1) return padLeft
        return padLeft + (idx / (hours.length - 1)) * plotWidth
    }

    // Dynamic Max Scales
    const maxSalesVal = useMemo(() => {
        if (filterMode === 'month') {
            if (monthViewMode === 'weekday_weekend') {
                const maxCumul = Math.max(
                    ...monthMetrics?.weekdayWeekendCurve.map(p => Math.max(p.weekdayCumulative, p.weekendCumulative)) || [10000]
                )
                return Math.max(maxCumul * 1.1, 5000)
            }
            const maxCumul = Math.max(...monthMetrics?.monthlyMasterPacing.map(p => p.cumulativeAvgSales) || [10000])
            return Math.max(maxCumul * 1.1, 5000)
        }
        const maxCumul = Math.max(
            dayMetrics?.totalGross || 0,
            dayMetrics?.projectedClosingSales || 0,
            ...dayMetrics?.benchmarkPoints.map(p => p.expectedCumulative) || [10000]
        )
        return Math.max(maxCumul * 1.1, 10000)
    }, [filterMode, monthViewMode, monthMetrics, dayMetrics])

    const maxPaxScale = useMemo(() => {
        if (filterMode === 'month') {
            return Math.max(...monthMetrics?.monthlyAvgHourly.map(p => p.avgPax) || [10], 15)
        }
        const highestVal = Math.max(
            ...dayMetrics?.points.map(p => Math.max(p.pax, p.baselinePax, p.forecastHigh || p.forecast || 0)) || [10],
            14
        )
        return Math.ceil((highestVal * 1.3) / 5) * 5
    }, [filterMode, monthMetrics, dayMetrics])

    const getYMoney = (val) => {
        const ratio = Math.min(1, Math.max(0, val / maxSalesVal))
        return padYTop + (1 - ratio) * plotHeight
    }

    const getYPax = (val) => {
        const ratio = Math.min(1, Math.max(0, val / maxPaxScale))
        return padYTop + (1 - ratio) * plotHeight
    }

    const getYBarHeight = (val, maxVal) => {
        const ratio = Math.min(1, Math.max(0, val / maxVal))
        return ratio * plotHeight
    }

    // -------------------------------------------------------------------------
    // DYNAMIC SVG PATHS (Flowing Dashed Forecast Line, High/Low Fan, Baseline)
    // -------------------------------------------------------------------------
    const cappedHour = dayMetrics?.cappedHour || 11

    // 1. Path for 4-Week Baseline Curve
    const pathBaselinePax = useMemo(() => {
        if (!dayMetrics?.points) return ''
        const coords = dayMetrics.points.map(pt => `${getX(pt.hour).toFixed(1)},${getYPax(pt.baselinePax).toFixed(1)}`)
        return `M ${coords.join(' L ')}`
    }, [dayMetrics, plotWidth, plotHeight, maxPaxScale])

    // 2. Paths for Dynamic Forecast Line (Animated Flowing Dash), High/Low Bounds & Fan Cone
    const { pathForecastBase, pathForecastHigh, pathForecastLow, pathForecastFan } = useMemo(() => {
        if (!isViewingToday || !dayMetrics?.points) {
            return { pathForecastBase: '', pathForecastHigh: '', pathForecastLow: '', pathForecastFan: '' }
        }

        const startHour = Math.min(22, cappedHour)
        const lastActive = dayMetrics.points.find(p => p.hour === startHour) || dayMetrics.points[0]
        const futurePoints = dayMetrics.points.filter(p => p.hour >= lastActive.hour)
        if (futurePoints.length < 2) {
            return { pathForecastBase: '', pathForecastHigh: '', pathForecastLow: '', pathForecastFan: '' }
        }

        const coordsBase = futurePoints.map(pt => {
            const val = pt.isFuture ? (pt.forecast ?? pt.baselinePax) : pt.pax
            return `${getX(pt.hour).toFixed(1)},${getYPax(val).toFixed(1)}`
        })

        const coordsHigh = futurePoints.map(pt => {
            const val = pt.isFuture ? (pt.forecastHigh ?? pt.baselinePax) : pt.pax
            return `${getX(pt.hour).toFixed(1)},${getYPax(val).toFixed(1)}`
        })

        const coordsLow = futurePoints.map(pt => {
            const val = pt.isFuture ? (pt.forecastLow ?? pt.baselinePax) : pt.pax
            return `${getX(pt.hour).toFixed(1)},${getYPax(val).toFixed(1)}`
        })

        const pBase = `M ${coordsBase.join(' L ')}`
        const pHigh = `M ${coordsHigh.join(' L ')}`
        const pLow = `M ${coordsLow.join(' L ')}`

        const reversedLow = [...futurePoints].reverse().map(pt => {
            const val = pt.isFuture ? (pt.forecastLow ?? pt.baselinePax) : pt.pax
            return `${getX(pt.hour).toFixed(1)},${getYPax(val).toFixed(1)}`
        })
        const pFan = `M ${coordsHigh.join(' L ')} L ${reversedLow.join(' L ')} Z`

        return { pathForecastBase: pBase, pathForecastHigh: pHigh, pathForecastLow: pLow, pathForecastFan: pFan }
    }, [isViewingToday, dayMetrics, cappedHour, plotWidth, plotHeight, maxPaxScale])

    // 3. Path for Actual Pax Line
    const pathActualPax = useMemo(() => {
        if (!dayMetrics?.points) return ''
        const activePts = isViewingToday
            ? dayMetrics.points.filter(p => p.hour <= cappedHour && p.pax > 0)
            : dayMetrics.points.filter(p => p.pax > 0)
        if (activePts.length < 2) return ''
        const coords = activePts.map(pt => `${getX(pt.hour).toFixed(1)},${getYPax(pt.pax).toFixed(1)}`)
        return `M ${coords.join(' L ')}`
    }, [isViewingToday, dayMetrics, cappedHour, plotWidth, plotHeight, maxPaxScale])

    // 4. Path for Projected Sales Velocity Curve (Connecting Current Sales to Closing Target)
    const pathForecastSales = useMemo(() => {
        if (!isViewingToday || !dayMetrics?.points) return ''
        const startH = Math.min(22, cappedHour)
        const futurePts = dayMetrics.points.filter(p => p.hour >= startH)
        if (futurePts.length < 2) return ''

        const curSales = dayMetrics.points.find(p => p.hour === startH)?.cumulativeSales || 0
        const targetEnd = dayMetrics.projectedClosingSales || dayMetrics.defaultTarget
        const totalRemaining = Math.max(1, 23 - startH)

        const coords = futurePts.map(pt => {
            const fraction = (pt.hour - startH) / totalRemaining
            const sVal = Math.round(curSales + (targetEnd - curSales) * fraction)
            return `${getX(pt.hour).toFixed(1)},${getYMoney(sVal).toFixed(1)}`
        })
        return `M ${coords.join(' L ')}`
    }, [isViewingToday, dayMetrics, cappedHour, plotWidth, plotHeight, maxSalesVal])

    // Thai Modern Colors (Dieter Rams Warm Tinted OKLCH Palette)
    const colorInk = 'oklch(18% 0.012 28)'
    const colorPaper = 'oklch(97% 0.008 28)'
    const colorPaper2 = 'oklch(94% 0.010 28)'
    const colorRule = 'oklch(85% 0.012 28)'
    const colorNeutral = 'oklch(55% 0.010 28)'
    const colorMuted = 'oklch(42% 0.010 28)'
    const colorAccent = 'oklch(52% 0.16 28)' // Terracotta
    const colorAccent2 = 'oklch(45% 0.08 140)' // Banana-Leaf Green
    const colorBaselinePax = 'oklch(62% 0.08 28)' // Warm Muted Terracotta for Historical Pax Baseline
    const colorBenchmarkSales = 'oklch(45% 0.015 28)' // Refined Charcoal Slate for Sales Target Benchmark

    // Operating Daypart & Dynamic Action Recommendation
    const currentDaypart = useMemo(() => {
        return getOperatingDaypart(currentBangkokTime.hour)
    }, [currentBangkokTime.hour])

    const operatingActionText = useMemo(() => {
        return getOperatingActionText(currentDaypart?.id, dayMetrics?.paceDeltaPct || 0)
    }, [currentDaypart, dayMetrics?.paceDeltaPct])

    return (
        <div ref={containerRef} className="rounded-2xl border border-[oklch(88%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(88%_0.012_28)] font-sans text-[oklch(18%_0.012_28)] w-full max-w-full overflow-hidden shadow-2xs">

            {/* ========================================================================= */}
            {/* 1. CLEAN BENTO HEADER TOOLBAR: TITLE, STATUS PILL & SEGMENTED TABS        */}
            {/* ========================================================================= */}
            <div className="p-4 md:p-5 bg-[oklch(97%_0.008_28)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="font-semibold text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                            {filterMode === 'month'
                                ? 'ความเร็วยอดขายและทราฟฟิกรายเดือน'
                                : 'ความเร็วยอดขายและทราฟฟิกรายชั่วโมง'}
                        </h3>
                        {filterMode === 'day' && isViewingToday && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded-full font-medium bg-[oklch(94%_0.02_140)] text-[oklch(35%_0.08_140)] border border-[oklch(84%_0.04_140)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.08_140)]" />
                                <span className="tabular-nums">Live {currentBangkokTime.label} น.</span>
                            </span>
                        )}
                        {filterMode === 'month' && (
                            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] font-medium border border-[oklch(88%_0.012_28)] tabular-nums">
                                {monthMetrics?.activeDaysCount || 0} วันทำการ
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-[oklch(50%_0.010_28)] mt-0.5">
                        {filterMode === 'month'
                            ? `แนวโน้มยอดขายเฉลี่ยรายชั่วโมงและสัดส่วน 4 ช่วงเวลา · เดือน ${selectedMonth || todayBangkok.slice(0, 7)}`
                            : 'ยอดขายสะสมรายชั่วโมงเทียบเกณฑ์เป้าหมาย พร้อมคาดการณ์จำนวนลูกค้า'}
                    </p>
                </div>

                {/* Rounded Segmented Pill Switcher (Non-clipping wrap) */}
                <div className="flex items-center flex-wrap gap-1 self-start lg:self-auto">
                    {filterMode === 'month' ? (
                        <div className="inline-flex flex-wrap items-center gap-1 bg-[oklch(94%_0.010_28)] p-1 rounded-xl border border-[oklch(88%_0.012_28)] text-xs">
                            {[
                                { id: 'pacing', label: 'เส้นความเร็ว' },
                                { id: 'weekday_weekend', label: 'ธรรมดา vs วันหยุด' },
                                { id: 'dayparts', label: '4 ช่วงเวลา' },
                                { id: 'ranking', label: 'อันดับวัน' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setMonthViewMode(tab.id)}
                                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                                        monthViewMode === tab.id
                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] shadow-2xs'
                                            : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(97%_0.008_28)]'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="inline-flex flex-wrap items-center gap-1 bg-[oklch(94%_0.010_28)] p-1 rounded-xl border border-[oklch(88%_0.012_28)] text-xs">
                            {[
                                { id: 'chart', label: 'กราฟรวม' },
                                { id: 'dayparts', label: '4 ช่วงเวลา' },
                                { id: 'ad_briefing', label: aiBriefing ? 'AI กลยุทธ์ (พร้อมดู)' : 'AI กลยุทธ์' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveSubTab(tab.id)}
                                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                                        activeSubTab === tab.id
                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] shadow-2xs'
                                            : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(97%_0.008_28)]'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 2. PACING SUMMARY STRIP (Compact on AdminDashboard, Full Grid Standalone) */}
            {/* ========================================================================= */}
            {compactMode && filterMode === 'day' ? (
                <div className="px-4 md:px-5 py-3 bg-[oklch(95.5%_0.008_28)] grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs">
                    <div className="min-w-0">
                        <div className="text-[11px] text-[oklch(50%_0.010_28)]">ช่วงเวลาตอนนี้</div>
                        <div className="font-semibold text-[oklch(18%_0.012_28)] mt-0.5 truncate">
                            {currentDaypart.thaiLabel} · <span className="font-mono font-normal text-[oklch(42%_0.010_28)]">{currentDaypart.rangeText}</span>
                        </div>
                    </div>

                    <div className="min-w-0">
                        <div className="text-[11px] text-[oklch(50%_0.010_28)]">อัตราขายต่อชั่วโมง</div>
                        <div className="font-mono font-semibold text-[oklch(18%_0.012_28)] mt-0.5 tabular-nums flex items-baseline gap-1.5 flex-wrap">
                            <span>฿{dayMetrics?.currentVelocityPerHour?.toLocaleString() || 0}/ชม.</span>
                            {dayMetrics?.peakHourPoint?.sale > 0 && (
                                <span className="text-[11px] font-normal text-[oklch(50%_0.010_28)]">
                                    พีค {dayMetrics.peakHourPoint.hour}:00 น.
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="min-w-0">
                        <div className="text-[11px] text-[oklch(50%_0.010_28)]">แนวโน้มปิดวัน & เป้า</div>
                        <div className="font-mono font-semibold mt-0.5 tabular-nums flex items-baseline gap-1.5 flex-wrap">
                            <span className={dayMetrics?.paceDeltaPct >= 0 ? 'text-[oklch(45%_0.08_140)]' : 'text-[oklch(52%_0.16_28)]'}>
                                {dayMetrics?.paceDeltaPct >= 0 ? `+${dayMetrics?.paceDeltaPct}%` : `${dayMetrics?.paceDeltaPct}%`} เทียบเป้า
                            </span>
                            {dayMetrics?.totalGuests > 0 && (
                                <span className="text-[11px] font-normal text-[oklch(50%_0.010_28)]">
                                    · ปิดวัน ~{dayMetrics?.projectedClosingPax} คน
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="min-w-0 col-span-2 lg:col-span-1">
                        <div className="text-[11px] text-[oklch(50%_0.010_28)]">คำแนะนำปฏิบัติการ</div>
                        <div className="font-medium text-[oklch(18%_0.012_28)] mt-0.5 truncate" title={operatingActionText}>
                            {operatingActionText}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[oklch(88%_0.012_28)] bg-[oklch(97%_0.008_28)]">
                    {filterMode === 'month' ? (
                        <>
                            <div className="p-4 space-y-1">
                                <div className="text-xs text-[oklch(50%_0.010_28)]">ยอดขายสะสมทั้งเดือน</div>
                                <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)] tabular-nums">
                                    ฿{monthMetrics?.monthGross.toLocaleString()}
                                </div>
                                <div className="text-[11px] font-mono text-[oklch(50%_0.010_28)] tabular-nums">
                                    เฉลี่ย ฿{monthMetrics ? Math.round(monthMetrics.monthGross / monthMetrics.activeDaysCount).toLocaleString() : 0} / วัน
                                </div>
                            </div>

                            <div className="p-4 space-y-1">
                                <div className="text-xs text-[oklch(50%_0.010_28)]">จำนวนลูกค้ารวม</div>
                                <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(52%_0.16_28)] tabular-nums">
                                    {monthMetrics?.monthPax.toLocaleString()} ท่าน
                                </div>
                                <div className="text-[11px] font-mono text-[oklch(50%_0.010_28)] tabular-nums">
                                    เฉลี่ย {monthMetrics ? Math.round(monthMetrics.monthPax / monthMetrics.activeDaysCount) : 0} ท่าน / วัน
                                </div>
                            </div>

                            <div className="p-4 space-y-1">
                                <div className="text-xs text-[oklch(50%_0.010_28)]">เวลาคุ้มทุนเฉลี่ย</div>
                                <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(45%_0.08_140)] tabular-nums">
                                    {monthMetrics?.breakEvenHour || '—'}
                                </div>
                                <div className="text-[11px] font-mono text-[oklch(50%_0.010_28)] tabular-nums">
                                    เป้าขั้นต่ำ ฿{monthMetrics?.dailyExpenseTarget.toLocaleString()}/วัน
                                </div>
                            </div>

                            <div className="p-4 space-y-1">
                                <div className="text-xs text-[oklch(50%_0.010_28)]">ช่วงเวลาทำยอดสูงสุด</div>
                                <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)]">
                                    {monthMetrics?.monthlyDayparts?.reduce((max, dp) => dp.sales > (max?.sales || 0) ? dp : max, null)?.label || '—'}
                                </div>
                                <div className="text-[11px] font-mono text-[oklch(50%_0.010_28)] tabular-nums">
                                    สัดส่วน {monthMetrics?.monthlyDayparts?.reduce((max, dp) => dp.sales > (max?.sales || 0) ? dp : max, null)?.percent || 0}% ของเดือน
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={`p-4 space-y-1 transition-colors ${dayMetrics?.isDailyGoalExceeded ? 'bg-[oklch(96%_0.02_140)]' : ''}`}>
                                <div className="flex items-center justify-between text-xs text-[oklch(50%_0.010_28)]">
                                    <span>ยอดขายสะสม</span>
                                    {dayMetrics?.isDailyGoalExceeded ? (
                                        <span className="text-[oklch(38%_0.10_140)] font-mono font-semibold text-[11px] tabular-nums">
                                            ทะลุเป้า ({dayMetrics.pctOfTarget}%)
                                        </span>
                                    ) : dayMetrics?.pctOfTarget > 0 ? (
                                        <span className="text-[oklch(18%_0.012_28)] font-mono font-semibold text-[11px] tabular-nums">{dayMetrics.pctOfTarget}%</span>
                                    ) : null}
                                </div>
                                <div className={`font-mono text-xl md:text-2xl font-bold tracking-tight tabular-nums ${dayMetrics?.isDailyGoalExceeded ? 'text-[oklch(38%_0.10_140)]' : 'text-[oklch(18%_0.012_28)]'}`}>
                                    ฿{dayMetrics?.totalGross.toLocaleString()}
                                </div>
                                <div className="text-[11px] font-mono text-[oklch(50%_0.010_28)] flex items-center gap-1.5 flex-wrap tabular-nums">
                                    <span>เป้า ฿{dayMetrics?.defaultTarget.toLocaleString()}</span>
                                    <span>·</span>
                                    <span className={dayMetrics?.paceDeltaPct >= 0 ? "text-[oklch(45%_0.08_140)] font-semibold" : "text-[oklch(52%_0.16_28)] font-semibold"}>
                                        {dayMetrics?.paceDeltaPct >= 0 ? `+${dayMetrics?.paceDeltaPct}%` : `${dayMetrics?.paceDeltaPct}%`}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 space-y-1">
                                <div className="flex items-center justify-between text-xs text-[oklch(50%_0.010_28)]">
                                    <span>จำนวนลูกค้า</span>
                                    <span className={`font-mono text-[11px] font-semibold ${dayMetrics?.totalGuests >= (dayMetrics?.baselinePaxSoFar || 0) ? 'text-[oklch(45%_0.08_140)]' : 'text-[oklch(52%_0.16_28)]'}`}>
                                        {dayMetrics?.totalGuests >= (dayMetrics?.baselinePaxSoFar || 0) ? 'ตามเป้า' : 'ชะลอตัว'}
                                    </span>
                                </div>
                                <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(52%_0.16_28)] tabular-nums">
                                    {dayMetrics?.totalGuests} ท่าน
                                </div>
                                <div className="text-[11px] font-mono text-[oklch(50%_0.010_28)] tabular-nums">
                                    {dayMetrics?.totalGuests > 0
                                        ? `คาดปิดวัน ~${dayMetrics?.projectedClosingPax} ท่าน (${dayMetrics?.forecastedClosingPaxLow}-${dayMetrics?.forecastedClosingPaxHigh})`
                                        : `สถิติ (${dayOfWeekThai}): ~${historicalBaseline.totalPax} ท่าน`}
                                </div>
                            </div>

                            <div className="p-4 space-y-1">
                                <div className="flex items-center justify-between text-xs text-[oklch(50%_0.010_28)]">
                                    <span>ความเร็วขาย</span>
                                    <span className="font-mono text-[11px] tabular-nums">{isViewingToday ? (currentBangkokTime.hour >= 11 ? `11:00–${currentBangkokTime.label}` : 'รอเปิด 11:00') : '11:00–23:00'}</span>
                                </div>
                                <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)] tabular-nums">
                                    ฿{dayMetrics?.currentVelocityPerHour?.toLocaleString() || 0} <span className="text-xs font-normal text-[oklch(50%_0.010_28)]">/ ชม.</span>
                                </div>
                                <div className="text-[11px] font-mono text-[oklch(50%_0.010_28)] tabular-nums">
                                    {dayMetrics?.peakHourPoint?.sale > 0
                                        ? `พีคสุด ฿${dayMetrics.peakHourPoint.sale.toLocaleString()} (${dayMetrics.peakHourPoint.hour}:00 น.)`
                                        : 'ช่วงพีคปกติ 18:00–20:00 น.'}
                                </div>
                            </div>

                            <div className="p-4 space-y-1">
                                <div className="flex items-center justify-between text-xs text-[oklch(50%_0.010_28)]">
                                    <span>สัญญาณออนไลน์</span>
                                    <span className="font-mono text-[11px] text-[oklch(45%_0.08_140)] font-medium">Intent</span>
                                </div>
                                <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(45%_0.08_140)] tabular-nums">
                                    {dayMetrics?.adHighIntent} สัญญาณ
                                </div>
                                <div className="text-[11px] font-mono text-[oklch(50%_0.010_28)] tabular-nums">
                                    แผนที่ {dayMetrics?.adDirs || 0} · โทร {dayMetrics?.adCalls || 0} · จอง {dayMetrics?.adBookings || 0}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* 3. VIEW 1: COCKPIT MAIN DUAL-LAYER GRAPH (When activeSubTab === 'chart')   */}
            {/* ========================================================================= */}
            {((filterMode === 'day' && activeSubTab === 'chart') ||
              (filterMode === 'month' && (monthViewMode === 'pacing' || monthViewMode === 'weekday_weekend'))) && (
                <div ref={chartWrapperRef} className="p-4 md:p-6 bg-[oklch(97%_0.008_28)] relative">
                    {/* Visual Legend (Streamlined inline cluster + rounded pills) */}
                    <div className="flex items-center justify-between gap-3 text-xs mb-4 flex-wrap">
                        <div className="flex items-center gap-3 md:gap-4 flex-wrap text-[11.5px] text-[oklch(42%_0.010_28)]">
                            {filterMode === 'month' && monthViewMode === 'weekday_weekend' ? (
                                <>
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="w-3 h-1 rounded-full bg-[oklch(52%_0.16_28)]" />
                                        <span className="text-[oklch(18%_0.012_28)] font-medium">จันทร์–ศุกร์ (เฉลี่ย)</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="w-3 h-1 rounded-full bg-[oklch(45%_0.08_140)]" />
                                        <span className="text-[oklch(18%_0.012_28)] font-medium">เสาร์–อาทิตย์ (เฉลี่ย)</span>
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-xs bg-[oklch(52%_0.16_28)]" />
                                        <span className="text-[oklch(18%_0.012_28)] font-medium">
                                            {filterMode === 'month' ? 'ยอดขายเฉลี่ย/ชม.' : 'ลูกค้าจริง (คน)'}
                                        </span>
                                    </span>
                                    {filterMode === 'day' && (
                                        <span className="inline-flex items-center gap-1.5" title="สถิติลูกค้าเฉลี่ยรอบ 4 สัปดาห์ (วันเดียวกัน)">
                                            <span className="w-3 h-2.5 rounded-xs bg-[oklch(90%_0.010_28)] border border-[oklch(80%_0.012_28)]" />
                                            <span>สถิติ {dayOfWeekThai}</span>
                                        </span>
                                    )}
                                    {filterMode === 'day' && showPredict && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="w-3.5 h-0 border-t-2 border-dashed border-[oklch(52%_0.16_28)]" />
                                            <span className="text-[oklch(52%_0.16_28)] font-medium">พยากรณ์ลูกค้า</span>
                                        </span>
                                    )}
                                    <span className="inline-flex items-center gap-1.5 sm:pl-3 sm:border-l border-[oklch(88%_0.012_28)]">
                                        <span className="w-3.5 h-1 rounded-full bg-[oklch(18%_0.012_28)]" />
                                        <span className="text-[oklch(18%_0.012_28)] font-medium">
                                            {filterMode === 'month' ? 'ยอดสะสม/วัน' : 'ยอดสะสม (฿)'}
                                        </span>
                                    </span>
                                    {filterMode === 'day' && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="w-3.5 h-0 border-t-2 border-dashed border-[oklch(45%_0.015_28)]" />
                                            <span>เป้าสะสม</span>
                                        </span>
                                    )}
                                    <span className="inline-flex items-center gap-1.5" title="ชั่วโมงที่ทำยอดเกินเป้าหมาย">
                                        <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_140)]" />
                                        <span className="text-[oklch(38%_0.08_140)] font-medium">ทะลุเป้า</span>
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Right Action: Clean Minimal & Predict Pills */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                type="button"
                                onClick={toggleMinimalMode}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                                    minimalMode
                                        ? 'bg-[oklch(45%_0.08_140)] text-[oklch(97%_0.008_28)] border-[oklch(45%_0.08_140)]'
                                        : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(88%_0.012_28)] hover:text-[oklch(18%_0.012_28)]'
                                }`}
                                title="โหมดกระชับสำหรับมือถือ 60fps"
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${minimalMode ? 'bg-[oklch(97%_0.008_28)]' : 'bg-[oklch(55%_0.010_28)]'}`} />
                                <span>{minimalMode ? 'Minimal · ON' : 'Minimal'}</span>
                            </button>

                            {filterMode === 'day' && !minimalMode && (
                                <button
                                    type="button"
                                    onClick={togglePredict}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                                        showPredict
                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                            : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(88%_0.012_28)] hover:text-[oklch(18%_0.012_28)]'
                                    }`}
                                    title="เปิดหรือปิดเส้นพยากรณ์ลูกค้าและยอดขาย"
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${showPredict ? 'bg-[oklch(52%_0.16_28)]' : 'bg-[oklch(55%_0.010_28)]'}`} />
                                    <span>{showPredict ? 'เส้นคาดการณ์ · ON' : 'เส้นคาดการณ์'}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Minimal Mode Active Status Bar on Mobile */}
                    {minimalMode && (
                        <div className="mb-3 px-3 py-1.5 bg-[oklch(94%_0.02_140)] border border-[oklch(85%_0.04_140)] rounded-xl flex items-center justify-between text-[11px] text-[oklch(32%_0.08_140)]">
                            <span>โหมดแสดงผลกระชับเพื่อความลื่นไหลบนมือถือ</span>
                            <button
                                type="button"
                                onClick={toggleMinimalMode}
                                className="underline hover:text-[oklch(18%_0.012_28)] cursor-pointer font-semibold shrink-0 ml-2"
                            >
                                แสดงรายละเอียดครบ &rarr;
                            </button>
                        </div>
                    )}

                    {/* Responsive Dual-Layer SVG Engine (Hardware Accelerated Composite Layer for iPad) */}
                    <div 
                        ref={chartScrollRef} 
                        className="w-full overflow-x-auto no-scrollbar" 
                        style={{ 
                            WebkitOverflowScrolling: 'touch', 
                            touchAction: 'pan-y',
                            transform: 'translateZ(0)',
                            WebkitTransform: 'translateZ(0)',
                            contain: 'paint'
                        }}
                        onTouchStart={() => setHoveredHour(null)}
                    >
                        <svg
                            width={isMobile ? svgWidth : '100%'}
                            height={isMobile ? svgHeight : undefined}
                            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                            className="block h-auto overflow-visible select-none"
                        >
                            <defs>
                                <style>{`
                                    /* High-Performance Dieter Rams SVG Engine (Simple, restrained one-shot entrance & transition motion) */
                                    @keyframes ramsSimpleFadeIn {
                                        from { opacity: 0; }
                                        to { opacity: 0.9; }
                                    }
                                    .forecast-stream-line {
                                        animation: ramsSimpleFadeIn 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
                                    }
                                    .rams-bar-motion {
                                        transition: height 280ms cubic-bezier(0.22, 1, 0.36, 1), y 280ms cubic-bezier(0.22, 1, 0.36, 1), fill 140ms ease-out;
                                    }
                                    @media (pointer: coarse), (max-width: 1024px), (prefers-reduced-motion: reduce) {
                                        .forecast-stream-line {
                                            animation: none !important;
                                        }
                                        .rams-bar-motion {
                                            transition: fill 140ms ease-out !important;
                                        }
                                    }
                                `}</style>
                            </defs>

                            {/* 1. Daypart Background Bands (Concise tier below NOW rail) */}
                            {DAYPARTS.map((dp, idx) => {
                                const startX = getX(dp.hours[0]) - (plotWidth / (hours.length - 1)) * 0.45
                                const endX = getX(dp.hours[dp.hours.length - 1]) + (plotWidth / (hours.length - 1)) * 0.45
                                const bandWidth = Math.max(10, endX - startX)
                                const isAlt = idx % 2 === 1
                                const startHourStr = String(dp.rangeText || '').split(' - ')[0]
                                const compactLabel = dp.id === 'lunch'
                                    ? `Lunch (${startHourStr})`
                                    : dp.id === 'afternoon'
                                    ? `Afternoon (${startHourStr})`
                                    : dp.id === 'dinner'
                                    ? `Dinner (${startHourStr})`
                                    : `Late (${startHourStr})`

                                return (
                                    <g key={dp.id} pointerEvents="none">
                                        <rect
                                            x={startX}
                                            y={padYTop}
                                            width={bandWidth}
                                            height={plotHeight}
                                            rx={4}
                                            fill={isAlt ? 'oklch(94.5%_0.009_28)' : 'transparent'}
                                            opacity="0.65"
                                        />
                                        <text
                                            x={startX + 6}
                                            y={padYTop - 8}
                                            fontSize="9"
                                            fontFamily="monospace"
                                            fontWeight="600"
                                            fill={colorMuted}
                                        >
                                            {compactLabel}
                                        </text>
                                        {idx > 0 && (
                                            <line
                                                x1={startX}
                                                y1={padYTop}
                                                x2={startX}
                                                y2={padYTop + plotHeight}
                                                stroke={colorRule}
                                                strokeWidth="1"
                                                strokeDasharray="2 3"
                                                opacity="0.7"
                                            />
                                        )}
                                    </g>
                                )
                            })}

                            {/* 2. Horizontal Gridlines (Money Axis on Left - Streamlined in Minimal Mode) */}
                            {(minimalMode ? [0, 0.5, 1.0] : [0, 0.25, 0.5, 0.75, 1.0]).map((step, idx) => {
                                const y = padYTop + (1 - step) * plotHeight
                                const valMoney = Math.round(maxSalesVal * step)
                                const valPax = Math.round(maxPaxScale * step)

                                return (
                                    <g key={idx}>
                                        <line
                                            x1={padLeft}
                                            y1={y}
                                            x2={padLeft + plotWidth}
                                            y2={y}
                                            stroke={colorRule}
                                            strokeWidth="1"
                                            opacity={idx === 0 ? '0.9' : '0.55'}
                                        />
                                        {/* Left: Money Axis */}
                                        <text
                                            x={padLeft - 8}
                                            y={y + 3}
                                            textAnchor="end"
                                            fontSize="9"
                                            fontFamily="monospace"
                                            fill={colorMuted}
                                        >
                                            {valMoney >= 1000 ? `${Math.round(valMoney / 1000)}k` : valMoney}
                                        </text>
                                        {/* Right: Pax Axis (in Day mode) */}
                                        {filterMode === 'day' && (
                                            <text
                                                x={padLeft + plotWidth + 8}
                                                y={y + 3}
                                                textAnchor="start"
                                                fontSize="9"
                                                fontFamily="monospace"
                                                fill={colorNeutral}
                                            >
                                                {valPax}p
                                            </text>
                                        )}
                                    </g>
                                )
                            })}

                            {/* 3. Live Current Time Indicator Marker (Clean upper rail, zero overlap with Daypart labels) */}
                            {filterMode === 'day' && isViewingToday && currentBangkokTime.hour >= 11 && currentBangkokTime.hour <= 23 && (() => {
                                const curFraction = (currentBangkokTime.hour - 11 + currentBangkokTime.minute / 60) / (hours.length - 1)
                                const curX = padLeft + Math.max(0, Math.min(1, curFraction)) * plotWidth
                                const pillW = 54
                                const clampedPillX = Math.max(padLeft + pillW / 2, Math.min(padLeft + plotWidth - pillW / 2, curX))
                                const nowPillY = 4
                                return (
                                    <g key="live-time-indicator" pointerEvents="none">
                                        <line
                                            x1={curX}
                                            y1={nowPillY + 16}
                                            x2={curX}
                                            y2={padYTop + plotHeight}
                                            stroke={colorAccent2}
                                            strokeWidth="1.25"
                                            strokeDasharray="3 3"
                                        />
                                        <circle
                                            cx={curX}
                                            cy={padYTop + plotHeight}
                                            r="3"
                                            fill={colorAccent2}
                                        />
                                        <rect
                                            x={clampedPillX - pillW / 2}
                                            y={nowPillY}
                                            width={pillW}
                                            height="15"
                                            fill={colorAccent2}
                                            rx="6"
                                        />
                                        <text
                                            x={clampedPillX}
                                            y={nowPillY + 10.5}
                                            textAnchor="middle"
                                            fontSize="8.5"
                                            fontFamily="monospace"
                                            fontWeight="bold"
                                            fill={colorPaper}
                                        >
                                            {currentBangkokTime.label} น.
                                        </text>
                                    </g>
                                )
                            })()}

                            {/* 4. Month Mode: Weekday vs Weekend Dual Curves */}
                            {filterMode === 'month' && monthViewMode === 'weekday_weekend' && (
                                <>
                                    {(() => {
                                        const pts = monthMetrics?.weekdayWeekendCurve || []
                                        const pathD = pts.reduce((acc, p, i) => {
                                            const x = getX(p.hour)
                                            const y = getYMoney(p.weekdayCumulative)
                                            return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                                        }, '')
                                        return (
                                            <path
                                                d={pathD}
                                                fill="none"
                                                stroke={colorAccent}
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                            />
                                        )
                                    })()}
                                    {(() => {
                                        const pts = monthMetrics?.weekdayWeekendCurve || []
                                        const pathD = pts.reduce((acc, p, i) => {
                                            const x = getX(p.hour)
                                            const y = getYMoney(p.weekendCumulative)
                                            return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                                        }, '')
                                        return (
                                            <path
                                                d={pathD}
                                                fill="none"
                                                stroke={colorAccent2}
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                            />
                                        )
                                    })()}
                                </>
                            )}

                            {/* 5. Month Mode: Standard Hourly Sales Bars */}
                            {filterMode === 'month' && monthViewMode !== 'weekday_weekend' && (
                                monthMetrics?.monthlyAvgHourly.map((pt) => {
                                    const x = getX(pt.hour)
                                    const barH = getYBarHeight(pt.avgSales, Math.max(...monthMetrics.monthlyAvgHourly.map(p => p.avgSales) || [1000], 1000))
                                    const isHovered = hoveredHour === pt.hour
                                    const monthAvgBench = monthMetrics?.monthlyAvgHourly?.length
                                        ? (monthMetrics.monthlyAvgHourly.reduce((sum, p) => sum + p.avgSales, 0) / monthMetrics.monthlyAvgHourly.length)
                                        : 0
                                    const isMonthGoalExceeded = pt.avgSales > monthAvgBench && pt.avgSales > 0

                                    return (
                                        <g key={pt.hour}>
                                            <rect
                                                x={x - 8}
                                                y={padYTop + plotHeight - barH}
                                                width={16}
                                                height={barH}
                                                rx={3}
                                                fill={isMonthGoalExceeded
                                                    ? (isHovered ? 'oklch(40% 0.09 140)' : 'oklch(45% 0.08 140)')
                                                    : (isHovered ? colorAccent : 'oklch(82% 0.015 28)')}
                                                className="rams-bar-motion cursor-pointer"
                                                onMouseEnter={() => {
                                                    if (!minimalMode && !isTouchDevice && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
                                                        setHoveredHour(pt.hour)
                                                    }
                                                }}
                                                onMouseLeave={() => {
                                                    if (!isTouchDevice) {
                                                        setHoveredHour(null)
                                                    }
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setHoveredHour(null)
                                                    setDrilldownHour(prev => prev === pt.hour ? null : pt.hour)
                                                }}
                                            />
                                        </g>
                                    )
                                })
                            )}

                            {/* 6. Day Mode: Ghost Baseline Bars & Solid Actual Pax Bars */}
                            {filterMode === 'day' && (
                                dayMetrics?.points.map((pt) => {
                                    const x = getX(pt.hour)
                                    const ghostBarH = getYBarHeight(pt.baselinePax, maxPaxScale)
                                    const actualBarH = getYBarHeight(pt.pax, maxPaxScale)
                                    const isHovered = hoveredHour === pt.hour
                                    const isPeak = dayMetrics.peakHourPoint?.hour === pt.hour && pt.pax > 0
                                    const isDrilldown = drilldownHour === pt.hour
                                    const isGoalExceeded = !!pt.isGoalExceeded

                                    // Calmer Thai Modern Olive when hour exceeded target, Terracotta Clay for active bars
                                    const barFill = isGoalExceeded
                                        ? (isDrilldown || isHovered ? 'oklch(40% 0.09 140)' : 'oklch(45% 0.08 140)')
                                        : (isDrilldown || isHovered || isPeak ? colorAccent : 'oklch(62% 0.11 28)')

                                    return (
                                        <g key={pt.hour}>
                                            {/* Active Column Highlight for Drill-Down Selection */}
                                            {isDrilldown && (
                                                <rect
                                                    x={x - (plotWidth / (hours.length - 1)) * 0.48}
                                                    y={padYTop}
                                                    width={(plotWidth / (hours.length - 1)) * 0.96}
                                                    height={plotHeight}
                                                    rx={4}
                                                    fill={colorAccent}
                                                    fillOpacity="0.10"
                                                    stroke={colorAccent}
                                                    strokeOpacity="0.45"
                                                    strokeWidth="1.2"
                                                    strokeDasharray="3 3"
                                                    className="pointer-events-none"
                                                />
                                            )}

                                            {/* Expected Baseline Ghost Bar (Streamlined tick in Minimal Mode) */}
                                            {minimalMode ? (
                                                <line
                                                    x1={x - 6}
                                                    y1={padYTop + plotHeight - ghostBarH}
                                                    x2={x + 6}
                                                    y2={padYTop + plotHeight - ghostBarH}
                                                    stroke="oklch(78% 0.012 28)"
                                                    strokeWidth="1.5"
                                                    strokeDasharray="2 2"
                                                    className="pointer-events-none"
                                                />
                                            ) : (
                                                <rect
                                                    x={x - 7}
                                                    y={padYTop + plotHeight - ghostBarH}
                                                    width={14}
                                                    height={ghostBarH}
                                                    rx={3}
                                                    fill="oklch(92% 0.010 28)"
                                                    stroke="oklch(86% 0.012 28)"
                                                    strokeWidth="0.8"
                                                    className="pointer-events-none"
                                                />
                                            )}

                                            {/* Actual Pax Solid Bar */}
                                            {pt.pax > 0 && (
                                                <rect
                                                    x={x - 7}
                                                    y={padYTop + plotHeight - actualBarH}
                                                    width={14}
                                                    height={actualBarH}
                                                    rx={3}
                                                    fill={barFill}
                                                    className="rams-bar-motion pointer-events-none"
                                                />
                                            )}

                                            {/* Celebratory Goal Beacon if hour exceeded target (Clean dot + delta label) */}
                                            {isGoalExceeded && actualBarH > 8 && (
                                                <g className="goal-beacon-group select-none pointer-events-none">
                                                    <circle
                                                        cx={x}
                                                        cy={padYTop + plotHeight - actualBarH - 6}
                                                        r="2.5"
                                                        fill="oklch(45% 0.08 140)"
                                                    />
                                                    {!minimalMode && pt.goalDeltaPct > 0 && (
                                                        <text
                                                            x={x}
                                                            y={padYTop + plotHeight - actualBarH - 12}
                                                            textAnchor="middle"
                                                            fontSize="8"
                                                            fontFamily="monospace"
                                                            fontWeight="600"
                                                            fill="oklch(38% 0.08 140)"
                                                            className="tabular-nums"
                                                        >
                                                            +{pt.goalDeltaPct}%
                                                        </text>
                                                    )}
                                                </g>
                                            )}

                                            {/* Full-Height Touch/Hover Hitbox for Drilldown Inspection (iOS WebKit Hit-Test Compliant) */}
                                            <rect
                                                x={x - (plotWidth / (hours.length - 1)) * 0.48}
                                                y={padYTop}
                                                width={(plotWidth / (hours.length - 1)) * 0.96}
                                                height={plotHeight}
                                                fill="transparent"
                                                pointerEvents="all"
                                                className="cursor-pointer select-none"
                                                onMouseEnter={() => {
                                                    if (!minimalMode && !isTouchDevice && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
                                                        setHoveredHour(pt.hour)
                                                    }
                                                }}
                                                onMouseLeave={() => {
                                                    if (!isTouchDevice) {
                                                        setHoveredHour(null)
                                                    }
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setHoveredHour(null)
                                                    setDrilldownHour(prev => prev === pt.hour ? null : pt.hour)
                                                }}
                                            />

                                            {/* Ad Intent Beacon Pin if leads happened at this hour (Positioned inside column top to prevent overlap) */}
                                            {pt.adTotal > 0 && (
                                                <g
                                                    className="cursor-pointer select-none"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setDrilldownHour(prev => prev === pt.hour ? null : pt.hour)
                                                    }}
                                                >
                                                    <rect
                                                        x={x - 13}
                                                        y={padYTop + 4}
                                                        width="26"
                                                        height="11.5"
                                                        rx="2"
                                                        fill="oklch(45% 0.08 140)"
                                                    />
                                                    <text
                                                        x={x}
                                                        y={padYTop + 12}
                                                        textAnchor="middle"
                                                        fill={colorPaper}
                                                        className="font-mono text-[7px] font-bold"
                                                    >
                                                        {pt.adDirs > 0 && pt.adInquiries > 0
                                                            ? `${pt.adTotal} SIG`
                                                            : (pt.adDirs > 0 ? `DIR ${pt.adDirs}` : `LEAD ${pt.adInquiries}`)}
                                                    </text>
                                                </g>
                                            )}
                                        </g>
                                    )
                                })
                            )}

                            {/* ================================================================= */}
                            {/* 7. DAY MODE: DYNAMIC FORECAST STREAMLINE & CONFIDENCE FAN (PREDICT) */}
                            {/* ================================================================= */}
                            {filterMode === 'day' && (
                                <>
                                    {/* 4-Week Baseline Curve (สถิติลูกค้าเดิม - Pax Baseline) */}
                                    {pathBaselinePax && (
                                        <path
                                            d={pathBaselinePax}
                                            fill="none"
                                            stroke={colorBaselinePax}
                                            strokeWidth="1.2"
                                            strokeDasharray="2 3"
                                            strokeLinecap="round"
                                            opacity="0.45"
                                        />
                                    )}

                                    {/* Shaded Forecast Confidence Fan (Single-pass solid blend, zero offscreen alpha buffer) */}
                                    {showPredict && !minimalMode && pathForecastFan && (
                                        <path
                                            d={pathForecastFan}
                                            fill="oklch(94% 0.02 28)"
                                            pointerEvents="none"
                                        />
                                    )}

                                    {/* Low Scenario Bound Line (ต่ำ) */}
                                    {showPredict && !minimalMode && pathForecastLow && (
                                        <path
                                            d={pathForecastLow}
                                            fill="none"
                                            stroke="oklch(60% 0.015 28)"
                                            strokeWidth="1.2"
                                            strokeDasharray="4 3"
                                            opacity="0.75"
                                        />
                                    )}

                                    {/* High Scenario Bound Line (สูง) */}
                                    {showPredict && !minimalMode && pathForecastHigh && (
                                        <path
                                            d={pathForecastHigh}
                                            fill="none"
                                            stroke="oklch(45% 0.08 140)"
                                            strokeWidth="1.4"
                                            strokeDasharray="4 3"
                                            opacity="0.85"
                                        />
                                    )}

                                    {/* Forecast Base Line (ANIMATED FLOWING DASH in standard, static in minimal) */}
                                    {showPredict && pathForecastBase && (
                                        <path
                                            d={pathForecastBase}
                                            fill="none"
                                            stroke="oklch(52% 0.16 28)"
                                            strokeWidth={isMobile ? '2.2' : '2.8'}
                                            strokeDasharray="6 4"
                                            strokeLinecap="round"
                                            className={minimalMode ? 'opacity-80' : 'forecast-stream-line opacity-90'}
                                        />
                                    )}

                                    {/* Actual Pax Solid Line */}
                                    {pathActualPax && (
                                        <path
                                            d={pathActualPax}
                                            fill="none"
                                            stroke="oklch(52% 0.16 28)"
                                            strokeWidth={isMobile ? '2.2' : '2.8'}
                                            strokeLinecap="round"
                                        />
                                    )}

                                    {/* Terminal Prediction Tags at 23:00 (Shown only when showPredict is ON and not minimal) */}
                                    {showPredict && !minimalMode && dayMetrics?.points && isViewingToday && (() => {
                                        const lastPt = dayMetrics.points[dayMetrics.points.length - 1]
                                        const fx = getX(23)
                                        const fyBase = getYPax(lastPt.forecast)
                                        const fyHigh = getYPax(lastPt.forecastHigh || lastPt.forecast)
                                        const fyLow = getYPax(lastPt.forecastLow || lastPt.forecast)

                                        return (
                                            <g key="terminal-pax-tags">
                                                {/* High Tag */}
                                                {lastPt.forecastHigh > lastPt.forecast && (
                                                    <g>
                                                        <circle cx={fx} cy={fyHigh} r="2.5" fill="oklch(45% 0.08 140)" />
                                                        <text
                                                            x={fx - 6}
                                                            y={fyHigh - 5}
                                                            textAnchor="end"
                                                            className="font-mono text-[8px] font-semibold fill-[oklch(45%_0.08_140)] tabular-nums"
                                                        >
                                                            สูง ~{lastPt.forecastHigh}p
                                                        </text>
                                                    </g>
                                                )}

                                                {/* Base Tag */}
                                                <circle cx={fx} cy={fyBase} r="2.8" fill="oklch(52% 0.16 28)" />

                                                {/* Low Tag */}
                                                {lastPt.forecastLow < lastPt.forecast && (
                                                    <circle cx={fx} cy={fyLow} r="2.2" fill="oklch(60% 0.015 28)" />
                                                )}
                                            </g>
                                        )
                                    })()}
                                </>
                            )}

                            {/* ================================================================= */}
                            {/* 8. SALES VELOCITY PACING LINES LAYER                              */}
                            {/* ================================================================= */}
                            {filterMode === 'day' && (
                                <>
                                    {/* Benchmark Target Curve */}
                                    {(() => {
                                        const bpts = dayMetrics?.benchmarkPoints || []
                                        if (bpts.length === 0) return null
                                        const pathD = bpts.reduce((acc, p, i) => {
                                             const x = getX(p.hour)
                                             const y = getYMoney(p.expectedCumulative)
                                             return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                                        }, '')
                                        const lastBpt = bpts[bpts.length - 1]
                                        const targetAmt = lastBpt?.expectedCumulative || 0

                                        return (
                                            <g key="benchmark-target-layer">
                                                <path
                                                    d={pathD}
                                                    fill="none"
                                                    stroke={colorBenchmarkSales}
                                                    strokeWidth="1.3"
                                                    strokeDasharray="4 4"
                                                    opacity="0.55"
                                                />
                                                {/* Subtle Terminal Target Tag at 23:00 (inside plot to keep right axis clean) */}
                                                {lastBpt && !minimalMode && (
                                                    <g>
                                                        <circle
                                                            cx={getX(23)}
                                                            cy={getYMoney(targetAmt)}
                                                            r="2.5"
                                                            fill={colorBenchmarkSales}
                                                        />
                                                        <text
                                                            x={getX(23) - 6}
                                                            y={getYMoney(targetAmt) - 6}
                                                            textAnchor="end"
                                                            className="font-mono text-[8.5px] font-semibold fill-[oklch(45%_0.015_28)] select-none tabular-nums"
                                                        >
                                                            เป้า ฿{Math.round(targetAmt / 1000)}k
                                                        </text>
                                                    </g>
                                                )}
                                            </g>
                                        )
                                    })()}

                                    {/* Dashed Projected Sales Velocity Line (Shown only when showPredict is ON) */}
                                    {showPredict && !minimalMode && pathForecastSales && (
                                        <path
                                            d={pathForecastSales}
                                            fill="none"
                                            stroke={colorInk}
                                            strokeWidth="2"
                                            strokeDasharray="4 3"
                                            strokeLinecap="round"
                                            opacity="0.8"
                                        />
                                    )}

                                    {/* Actual Cumulative Sales Solid Curve */}
                                    {(() => {
                                        const pts = dayMetrics?.activePoints || []
                                        if (pts.length === 0) return null
                                        const pathD = pts.reduce((acc, p, i) => {
                                            const x = getX(p.hour)
                                            const y = getYMoney(p.cumulativeSales)
                                            return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                                        }, '')
                                        return (
                                            <path
                                                d={pathD}
                                                fill="none"
                                                stroke={colorInk}
                                                strokeWidth="2.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        )
                                    })()}
                                </>
                            )}

                            {/* Month Mode: Cumulative Master Curve */}
                            {filterMode === 'month' && monthViewMode === 'pacing' && (() => {
                                const pts = monthMetrics?.monthlyMasterPacing || []
                                const pathD = pts.reduce((acc, p, i) => {
                                    const x = getX(p.hour)
                                    const y = getYMoney(p.cumulativeAvgSales)
                                    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                                }, '')
                                return (
                                    <path
                                        d={pathD}
                                        fill="none"
                                        stroke={colorInk}
                                        strokeWidth="2.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                )
                            })()}

                            {/* 9. X-Axis Hour Labels (Filter to milestone hours on mobile in Minimal Mode) */}
                            {hours
                                .filter(h => !minimalMode || !isMobile || [11, 14, 17, 20, 23].includes(h))
                                .map((h) => {
                                    const x = getX(h)
                                    const isHovered = hoveredHour === h
                                    const isDrill = drilldownHour === h
                                    const pt = dayMetrics?.points?.find(p => p.hour === h)
                                    const isGoal = filterMode === 'day' && pt?.isGoalExceeded

                                    return (
                                        <g
                                            key={h}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setHoveredHour(null)
                                                setDrilldownHour(prev => prev === h ? null : h)
                                            }}
                                            className="cursor-pointer select-none"
                                        >
                                            <line
                                                x1={x}
                                                y1={padYTop + plotHeight}
                                                x2={x}
                                                y2={padYTop + plotHeight + (isDrill ? 6 : 4)}
                                                stroke={isDrill ? colorAccent : (isGoal ? 'oklch(50% 0.15 142)' : colorRule)}
                                                strokeWidth={isDrill ? "2" : (isGoal ? "1.5" : "1")}
                                            />
                                            <text
                                                x={x}
                                                y={padYTop + plotHeight + 16}
                                                textAnchor="middle"
                                                fontSize="9"
                                                fontFamily="monospace"
                                                fill={isDrill ? colorAccent : (isGoal ? 'oklch(44% 0.17 142)' : (isHovered ? colorInk : colorMuted))}
                                                fontWeight={isDrill || isHovered || isGoal ? 'bold' : 'normal'}
                                            >
                                                {h}:00
                                            </text>
                                            {isGoal && !minimalMode && (
                                                <circle
                                                    cx={x}
                                                    cy={padYTop + plotHeight + 23}
                                                    r="1.8"
                                                    fill="oklch(50% 0.15 142)"
                                                />
                                            )}
                                        </g>
                                    )
                                })}

                            {/* 10. Hover Crosshair Cursor */}
                            {hoveredHour !== null && (
                                <g>
                                    <line
                                        x1={getX(hoveredHour)}
                                        y1={padYTop}
                                        x2={getX(hoveredHour)}
                                        y2={padYTop + plotHeight}
                                        stroke={colorInk}
                                        strokeWidth="1"
                                        strokeDasharray="2 2"
                                    />
                                    {/* Crosshair dot on Money Curve */}
                                    <circle
                                        cx={getX(hoveredHour)}
                                        cy={getYMoney(
                                            filterMode === 'month'
                                                ? monthMetrics?.monthlyMasterPacing?.find(p => p.hour === hoveredHour)?.cumulativeAvgSales || 0
                                                : dayMetrics?.points?.find(p => p.hour === hoveredHour)?.cumulativeSales || 0
                                        )}
                                        r="4.5"
                                        fill={colorInk}
                                        stroke={colorPaper2}
                                        strokeWidth="2"
                                    />
                                    {/* Crosshair dot on Pax Curve */}
                                    {filterMode === 'day' && (
                                        <circle
                                            cx={getX(hoveredHour)}
                                            cy={getYPax(
                                                dayMetrics?.points?.find(p => p.hour === hoveredHour)?.pax ||
                                                dayMetrics?.points?.find(p => p.hour === hoveredHour)?.forecast || 0
                                            )}
                                            r="4"
                                            fill={colorAccent}
                                            stroke={colorPaper2}
                                            strokeWidth="2"
                                        />
                                    )}
                                </g>
                            )}
                        </svg>
                    </div>

                    {/* Operational Helper Footnote */}
                    <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[oklch(50%_0.010_28)]">
                        <span>คลิกที่แท่งชั่วโมงบนกราฟเพื่อดูรายละเอียดบิลและเมนูยอดนิยมในชั่วโมงนั้น</span>
                        {drilldownHour !== null && (
                            <button
                                type="button"
                                onClick={() => setDrilldownHour(null)}
                                className="self-end sm:self-auto shrink-0 px-2.5 py-1 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(88%_0.012_28)] text-[oklch(18%_0.012_28)] font-medium rounded-lg cursor-pointer transition-colors"
                            >
                                ปิดมุมมอง {drilldownHour}:00 น.
                            </button>
                        )}
                    </div>

                    {/* Live Synchronized Tooltip Box */}
                    {hoveredHour !== null && (
                        <div className="mt-3 p-3.5 bg-[oklch(95.5%_0.008_28)] border border-[oklch(88%_0.012_28)] rounded-xl text-xs flex flex-wrap items-center justify-between gap-3 relative">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono font-semibold tabular-nums">
                                    {hoveredHour}:00 – {hoveredHour + 1}:00
                                </span>
                                <span className="text-[oklch(42%_0.010_28)] font-medium">
                                    {DAYPARTS.find(d => d.hours.includes(hoveredHour))?.thaiLabel || ''}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setHoveredHour(null)}
                                className="px-2.5 py-1 text-[11px] bg-[oklch(97%_0.008_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(88%_0.012_28)] text-[oklch(18%_0.012_28)] font-medium rounded-lg cursor-pointer ml-auto transition-colors"
                                title="ปิดการแสดงผลชั่วโมง"
                            >
                                ปิด
                            </button>
                            {filterMode === 'month' ? (
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div>
                                        <span className="text-[oklch(42%_0.010_28)]">ยอดขายเฉลี่ยชั่วโมงนี้: </span>
                                        <span className="font-bold text-[oklch(18%_0.012_28)]">
                                            ฿{monthMetrics?.monthlyAvgHourly?.find(p => p.hour === hoveredHour)?.avgSales.toLocaleString()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[oklch(42%_0.010_28)]">ลูกค้าเฉลี่ย: </span>
                                        <span className="font-bold text-[oklch(52%_0.16_28)]">
                                            {monthMetrics?.monthlyAvgHourly?.find(p => p.hour === hoveredHour)?.avgPax} ท่าน
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[oklch(42%_0.010_28)]">ยอดสะสมเฉลี่ยสิ้นชม.: </span>
                                        <span className="font-bold text-[oklch(18%_0.012_28)]">
                                            ฿{monthMetrics?.monthlyMasterPacing?.find(p => p.hour === hoveredHour)?.cumulativeAvgSales.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ) : (() => {
                                const pt = dayMetrics?.points?.find(p => p.hour === hoveredHour)
                                return (
                                    <div className="flex items-center gap-4 flex-wrap">
                                        {pt?.isGoalExceeded && (
                                            <span className="px-2 py-0.5 bg-[oklch(50%_0.15_142)] text-white font-bold text-[10px] rounded-xs flex items-center gap-1 shadow-xs animate-in fade-in duration-150">
                                                <span>[GOAL HIT]</span>
                                                {pt.goalDeltaPct > 0 && <span>+{pt.goalDeltaPct}%</span>}
                                            </span>
                                        )}
                                        <div>
                                            <span className="text-[oklch(42%_0.010_28)]">
                                                {pt?.isFuture ? 'คาดการณ์ (FORECAST): ' : 'ลูกค้าจริง: '}
                                            </span>
                                            <span className="font-bold text-[oklch(52%_0.16_28)]">
                                                {pt?.isFuture ? `~${pt?.forecast} ท่าน (กรอบ ${pt?.forecastLow}-${pt?.forecastHigh})` : `${pt?.pax || 0} ท่าน`}
                                            </span>
                                            <span className="text-[10px] text-[oklch(42%_0.010_28)] ml-1">
                                                (สถิติเดิม: ~{pt?.baselinePax} ท่าน)
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[oklch(42%_0.010_28)]">ยอดขาย: </span>
                                            <span className={`font-bold ${pt?.isGoalExceeded ? 'text-[oklch(44%_0.17_142)]' : 'text-[oklch(18%_0.012_28)]'}`}>
                                                ฿{(pt?.sale || 0).toLocaleString()}
                                            </span>
                                            <span className="text-[10px] text-[oklch(42%_0.010_28)] ml-1">
                                                (เป้าชม.: ฿{(pt?.targetSales || 0).toLocaleString()})
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[oklch(42%_0.010_28)]">ยอดสะสม: </span>
                                            <span className="font-bold text-[oklch(18%_0.012_28)]">
                                                ฿{(pt?.cumulativeSales || 0).toLocaleString()}
                                            </span>
                                            <span className="text-[10px] text-[oklch(42%_0.010_28)] ml-1">
                                                (เกณฑ์เป้า: ฿{(pt?.benchmarkCumulative || 0).toLocaleString()})
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[oklch(42%_0.010_28)]">เฉลี่ย/หัว: </span>
                                            <span className="font-bold text-[oklch(45%_0.08_140)]">
                                                ฿{pt?.spendPerHead || 0}
                                            </span>
                                        </div>
                                        {pt?.adTotal > 0 && (
                                            <div>
                                                <span className="text-[oklch(42%_0.010_28)]">สัญญาณค้นหา: </span>
                                                <span className="font-bold text-[oklch(45%_0.08_140)]">
                                                    {pt.adTotal} สัญญาณ
                                                </span>
                                                <span className="text-[10px] text-[oklch(42%_0.010_28)] ml-1">
                                                    (แผนที่ {pt.adDirs} · ติดต่อ {pt.adInquiries})
                                                </span>
                                            </div>
                                        )}
                                        {pt?.isFuture && pt?.isLifted && (
                                            <div>
                                                <span className="text-[10px] text-[oklch(45%_0.08_140)] font-bold">
                                                    AD LIFT +{Math.round((dayMetrics?.adLiftPct || 0) * 100)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
                        </div>
                    )}

                    {/* Hourly Drill-Down Inspector Drawer */}
                    {drilldownHour !== null && drillHourData && (
                        <div
                            ref={inspectorRef}
                            className="mt-4 p-4 sm:p-5 bg-[oklch(95.5%_0.008_28)] border border-[oklch(86%_0.012_28)] rounded-2xl text-xs space-y-4 w-full max-w-full overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[oklch(88%_0.012_28)]">
                                <div className="flex items-center gap-2.5 flex-wrap min-w-0 flex-1">
                                    <span className="px-2.5 py-1 rounded-lg bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono font-semibold text-xs tabular-nums shrink-0">
                                        {drilldownHour}:00 – {drilldownHour + 1}:00 น.
                                    </span>
                                    <span className="font-semibold text-sm text-[oklch(18%_0.012_28)] truncate">
                                        {DAYPARTS.find(d => d.hours.includes(drilldownHour))?.thaiLabel || ''}
                                    </span>
                                    <span className="text-[oklch(85%_0.012_28)] hidden sm:inline">·</span>
                                    <span className="text-xs text-[oklch(50%_0.010_28)] break-words">
                                        {drillHourData.isFuture
                                            ? 'ช่วงเวลาคาดการณ์ล่วงหน้า'
                                            : (drillHourData.sale > 0
                                                ? (filterMode === 'month' ? 'ยอดขายสะสมทั้งเดือน' : 'ยอดขายที่บันทึกแล้ว')
                                                : 'ไม่มีรายการคำสั่งซื้อ')}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setDrilldownHour(null)}
                                    className="shrink-0 px-3 py-1.5 bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(88%_0.012_28)] font-medium text-xs rounded-xl transition-colors cursor-pointer"
                                >
                                    ปิดมุมมองนี้
                                </button>
                            </div>

                            {/* 4 Metric Cells */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                                <div className={`p-2.5 sm:p-3 bg-[oklch(97%_0.008_28)] border min-w-0 ${
                                    drillHourData.isGoalExceeded
                                        ? 'border-[oklch(50%_0.15_142)] bg-[oklch(50%_0.15_142_/_0.06)]'
                                        : 'border-[oklch(85%_0.012_28)]'
                                }`}>
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="text-[9px] sm:text-[10px] text-[oklch(42%_0.010_28)] font-bold truncate">HOURLY SALES</div>
                                        {drillHourData.isGoalExceeded && (
                                            <span className="px-1.5 py-0.2 bg-[oklch(50%_0.15_142)] text-white text-[8px] sm:text-[9px] font-bold rounded-xs shrink-0">
                                                [GOAL HIT +{drillHourData.goalDeltaPct}%]
                                            </span>
                                        )}
                                    </div>
                                    <div className={`text-base sm:text-lg md:text-xl font-bold mt-0.5 truncate ${
                                        drillHourData.isGoalExceeded ? 'text-[oklch(44%_0.17_142)]' : 'text-[oklch(18%_0.012_28)]'
                                    }`}>
                                        ฿{(drillHourData.sale || 0).toLocaleString()}
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] text-[oklch(42%_0.010_28)] mt-1 truncate flex items-center justify-between gap-1">
                                        <span>สะสม: ฿{(drillHourData.cumulativeSales || 0).toLocaleString()}</span>
                                        {filterMode === 'month' ? (
                                            <span>เฉลี่ย: ฿{(drillHourData.avgSales || 0).toLocaleString()}/วัน</span>
                                        ) : (
                                            <span>เป้า: ฿{(drillHourData.targetSales || 0).toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="p-2.5 sm:p-3 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] min-w-0">
                                    <div className="text-[9px] sm:text-[10px] text-[oklch(42%_0.010_28)] font-bold truncate">GUEST TRAFFIC</div>
                                    <div className="text-base sm:text-lg md:text-xl font-bold text-[oklch(52%_0.16_28)] mt-0.5 truncate">
                                        {drillHourData.isFuture ? `~${drillHourData.forecast} Pax` : `${drillHourData.pax || 0} Pax`}
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] text-[oklch(42%_0.010_28)] mt-1 truncate">
                                        {drillHourData.isFuture && drillHourData.isLifted ? (
                                            <span>สถิติเดิม: ~{drillHourData.baselinePax} Pax <span className="text-[oklch(45%_0.08_140)] font-bold">(หนุน Ad Lift +{Math.round((dayMetrics?.adLiftPct || 0) * 100)}%)</span></span>
                                        ) : (
                                            filterMode === 'month'
                                                ? `สถิติเฉลี่ย: ~${drillHourData.avgPax || 0} Pax/วัน`
                                                : `สถิติเดิม: ~${drillHourData.baselinePax} Pax`
                                        )}
                                    </div>
                                </div>

                                <div className="p-2.5 sm:p-3 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] min-w-0">
                                    <div className="text-[9px] sm:text-[10px] text-[oklch(42%_0.010_28)] font-bold truncate">BILLS & AVERAGE CHECK</div>
                                    <div className="text-base sm:text-lg md:text-xl font-bold text-[oklch(18%_0.012_28)] mt-0.5 truncate">
                                        {drillHourOrders.length} บิล
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] text-[oklch(42%_0.010_28)] mt-1 truncate">
                                        เฉลี่ย ฿{drillHourOrders.length > 0 ? Math.round((drillHourData.sale || 0) / drillHourOrders.length).toLocaleString() : 0} / บิล
                                    </div>
                                </div>

                                <div className="p-2.5 sm:p-3 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="text-[9px] sm:text-[10px] text-[oklch(42%_0.010_28)] font-bold truncate">ONLINE SEARCH INTENT</div>
                                        <span className="text-[9px] text-[oklch(55%_0.010_28)] font-mono shrink-0">
                                            {drilldownHour}:00 น.
                                        </span>
                                    </div>
                                    <div className="text-base sm:text-lg md:text-xl font-bold text-[oklch(45%_0.08_140)] mt-0.5 truncate">
                                        {drillHourData.adTotal || 0} Signals
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] text-[oklch(42%_0.010_28)] mt-1 truncate">
                                        {drillHourData.isFuture && (drillHourData.adTotal || 0) === 0 ? (
                                            <span className="text-[oklch(55%_0.010_28)]">
                                                {drillHourData.isLifted
                                                    ? `ช่วงเวลานี้ยังมาไม่ถึง · มีแรงหนุน Ad Lift +${Math.round((dayMetrics?.adLiftPct || 0) * 100)}%`
                                                    : 'ช่วงเวลานี้ยังมาไม่ถึง'}
                                            </span>
                                        ) : (
                                            `แผนที่: ${drillHourData.adDirs || 0} · ติดต่อ/จอง: ${drillHourData.adInquiries || 0}`
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Top Items Ordered in this hour */}
                            <div className="pt-2">
                                <div className="text-[10px] sm:text-[11px] font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider mb-2 flex items-center justify-between">
                                    <span className="truncate">TOP MENU ITEMS IN THIS HOUR // รายการอาหารยอดนิยม</span>
                                    <span className="text-[10px] text-[oklch(42%_0.010_28)] font-normal shrink-0">
                                        {drillTopItems.length > 0 ? `${drillTopItems.length} รายการหลัก` : ''}
                                    </span>
                                </div>

                                {drillTopItems.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
                                        {drillTopItems.map((item, idx) => (
                                            <div
                                                key={item.name + idx}
                                                className="p-2 sm:p-2.5 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] flex items-center justify-between min-w-0"
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <div className="font-bold text-[11px] text-[oklch(18%_0.012_28)] truncate" title={item.name}>
                                                        {idx + 1}. {item.name}
                                                    </div>
                                                    <div className="text-[10px] text-[oklch(42%_0.010_28)]">
                                                        จำนวน {item.qty} ที่
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="font-bold text-[oklch(18%_0.012_28)]">
                                                        ฿{item.total.toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-3.5 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-center text-[oklch(42%_0.010_28)] text-[11px]">
                                        {drillHourData.isFuture
                                            ? 'ช่วงเวลาคาดการณ์ในอนาคต — ยังไม่มีรายการคำสั่งซื้อจริงที่ถูกบันทึก'
                                            : 'ไม่มีรายการสั่งซื้อในช่วงชั่วโมงนี้'}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* 4. VIEW 2: DEDICATED 4-DAYPARTS WORKBENCH (When activeSubTab === 'dayparts')*/}
            {/* ========================================================================= */}
            {((filterMode === 'day' && activeSubTab === 'dayparts') ||
              (filterMode === 'month' && monthViewMode === 'dayparts')) && (
                <div className="p-4 md:p-6 bg-[oklch(95.5%_0.008_28)] space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="space-y-0.5">
                            <h4 className="font-semibold text-sm md:text-base text-[oklch(18%_0.012_28)]">
                                {filterMode === 'month'
                                    ? `สัดส่วนรายได้และประสิทธิภาพ 4 ช่วงเวลา · เดือน ${selectedMonth || todayBangkok.slice(0, 7)}`
                                    : `สถิติ 4 ช่วงเวลาของวัน (${dayOfWeekThai} ${targetDateObj.toLocaleDateString('th-TH', { dateStyle: 'medium' })})`}
                            </h4>
                            <span className="text-xs text-[oklch(50%_0.010_28)]">
                                อัตราเร่งยอดขายรายชั่วโมง (฿ / ชั่วโมง)
                            </span>
                        </div>
                    </div>

                    {/* 4 Rich Daypart Dossier Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {(filterMode === 'month' ? monthMetrics?.monthlyDayparts : dayMetrics?.daypartBreakdown)?.map((dp) => {
                            const isPassed = dp.status === 'passed'
                            const isActive = dp.status === 'active'

                            const isGoalHit = !!dp.isGoalExceeded

                            return (
                                <div
                                    key={dp.id}
                                    className={`p-4 bg-[oklch(97%_0.008_28)] rounded-2xl border transition-colors space-y-3 ${
                                        isGoalHit
                                            ? 'border-[oklch(45%_0.08_140)] bg-[oklch(95%_0.02_140)]'
                                            : isActive
                                            ? 'border-[oklch(52%_0.16_28)] shadow-2xs'
                                            : 'border-[oklch(88%_0.012_28)]'
                                    }`}
                                >
                                    {/* Card Header */}
                                    <div className="flex items-center justify-between border-b border-[oklch(88%_0.012_28)] pb-2.5">
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-semibold text-xs text-[oklch(18%_0.012_28)]">{dp.label}</span>
                                                {isActive && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[oklch(52%_0.16_28)]" />
                                                )}
                                            </div>
                                            <div className="text-[11px] font-mono text-[oklch(50%_0.010_28)]">
                                                {dp.thaiLabel} ({dp.rangeText})
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {isGoalHit && (
                                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[oklch(45%_0.08_140)] text-[oklch(97%_0.008_28)] tabular-nums">
                                                    +{dp.goalDeltaPct}%
                                                </span>
                                            )}
                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                                isActive
                                                    ? 'bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)]'
                                                    : isPassed
                                                    ? 'bg-[oklch(91%_0.010_28)] text-[oklch(42%_0.010_28)]'
                                                    : 'bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)] text-[oklch(50%_0.010_28)]'
                                            }`}>
                                                {isActive ? 'กำลังดำเนินการ' : isPassed ? 'จบช่วง' : 'ถัดไป'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Primary Figures */}
                                    <div className="space-y-1">
                                        <div className="flex items-baseline justify-between">
                                            <span className={`font-mono text-xl font-bold tabular-nums ${
                                                isGoalHit ? 'text-[oklch(38%_0.08_140)]' : 'text-[oklch(18%_0.012_28)]'
                                            }`}>
                                                ฿{dp.sales.toLocaleString()}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                {filterMode === 'day' && dp.dpTargetSales > 0 && (
                                                    <span className="text-[10.5px] font-mono text-[oklch(50%_0.010_28)] tabular-nums">
                                                        (เป้า ฿{dp.dpTargetSales >= 1000 ? `${Math.round(dp.dpTargetSales / 1000)}k` : dp.dpTargetSales})
                                                    </span>
                                                )}
                                                <span className="text-xs font-mono font-semibold text-[oklch(52%_0.16_28)] tabular-nums">
                                                    {dp.percent}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs font-mono text-[oklch(48%_0.010_28)] tabular-nums">
                                            <span>
                                                ลูกค้า <strong className="text-[oklch(18%_0.012_28)]">{dp.pax}</strong> ท่าน
                                                {filterMode === 'day' && (
                                                    <span className="text-[10.5px] ml-1 text-[oklch(55%_0.010_28)]">(สถิติ ~{dp.baselinePax})</span>
                                                )}
                                            </span>
                                            <span>฿{dp.spendPerHead}/หัว</span>
                                        </div>
                                    </div>

                                    {/* Operational Velocity & Guidance */}
                                    <div className="pt-2.5 border-t border-[oklch(88%_0.012_28)] space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                                            <span className="text-[oklch(50%_0.010_28)]">อัตราเร่ง:</span>
                                            <span className="font-semibold text-[oklch(45%_0.08_140)]">
                                                ฿{dp.hourlyVelocity.toLocaleString()} / ชม.
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[oklch(48%_0.010_28)] font-sans leading-relaxed">
                                            {dp.desc}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Hourly Daypart Performance Matrix Table */}
                    <div className="border border-[oklch(88%_0.012_28)] bg-[oklch(97%_0.008_28)] rounded-2xl overflow-hidden">
                        <div className="p-3.5 px-4 bg-[oklch(95.5%_0.008_28)] border-b border-[oklch(88%_0.012_28)] flex items-center justify-between flex-wrap gap-2">
                            <span className="font-semibold text-xs text-[oklch(18%_0.012_28)]">
                                {filterMode === 'month' ? `ตารางแจกแจงรายชั่วโมงสะสมประจำเดือน ${selectedMonth || todayBangkok.slice(0, 7)}` : 'ตารางแจกแจงรายชั่วโมง 11:00 – 23:00 น.'}
                            </span>
                            <span className="font-mono text-[11px] text-[oklch(50%_0.010_28)]">
                                {filterMode === 'month' ? `${monthMetrics?.activeDaysCount || 0} วันทำการ · 13 ช่วงเวลา` : '13 ช่วงเวลา'}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left font-mono text-xs divide-y divide-[oklch(85%_0.012_28)]">
                                <thead className="bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] text-[10px] uppercase">
                                    <tr>
                                        <th className="p-2.5">ชั่วโมง (Hour)</th>
                                        <th className="p-2.5">ช่วงเวลา (Daypart)</th>
                                        <th className="p-2.5 text-right">{filterMode === 'month' ? 'ลูกค้าจริง (รวม / เฉลี่ยวัน)' : 'ลูกค้าจริง / คาดการณ์'}</th>
                                        <th className="p-2.5 text-right">{filterMode === 'month' ? 'ยอดขายรวม (฿)' : 'ยอดขาย (฿)'}</th>
                                        <th className="p-2.5 text-right">ยอดสะสม (฿)</th>
                                        <th className="p-2.5 text-right">เฉลี่ย/หัว (฿)</th>
                                        <th className="p-2.5 text-right">จำนวนบิล</th>
                                        <th className="p-2.5 text-right">อัตราครองโต๊ะ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
                                    {hours.map((h) => {
                                        const pt = filterMode === 'month'
                                            ? monthMetrics?.monthlyAvgHourly?.find(p => p.hour === h)
                                            : dayMetrics?.points?.find(p => p.hour === h)
                                        const dp = DAYPARTS.find(d => d.hours.includes(h))
                                        const isCurrentHour = filterMode === 'day' && isViewingToday && currentBangkokTime.hour === h
                                        const isGoal = filterMode === 'day' && !!pt?.isGoalExceeded

                                        return (
                                            <tr
                                                key={h}
                                                className={`transition-colors ${
                                                    isCurrentHour
                                                        ? 'bg-[oklch(52%_0.16_28)]/10 font-bold'
                                                        : isGoal
                                                        ? 'bg-[oklch(50%_0.15_142)]/5 hover:bg-[oklch(50%_0.15_142)]/10'
                                                        : 'hover:bg-[oklch(94%_0.010_28)]'
                                                }`}
                                            >
                                                <td className="p-2.5 font-bold text-[oklch(18%_0.012_28)] flex items-center gap-1.5">
                                                    <span>{h}:00 - {h + 1}:00</span>
                                                    {isCurrentHour && (
                                                        <span className="px-1 py-0.2 text-[8px] bg-[oklch(45%_0.08_140)] text-white uppercase">
                                                            NOW
                                                        </span>
                                                    )}
                                                    {isGoal && (
                                                        <span className="px-1 py-0.2 text-[8px] bg-[oklch(50%_0.15_142)] text-white uppercase font-bold">
                                                            GOAL
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-[oklch(42%_0.010_28)]">
                                                    {dp?.label}
                                                </td>
                                                <td className="p-2.5 text-right">
                                                    {filterMode === 'month' ? (
                                                        <>
                                                            <span className="font-bold text-[oklch(18%_0.012_28)]">
                                                                {(pt?.pax || 0).toLocaleString()} ท่าน
                                                            </span>
                                                            <span className="text-[oklch(42%_0.010_28)] ml-1 text-[10px]">
                                                                / เฉลี่ย ~{pt?.avgPax || 0}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="font-bold text-[oklch(18%_0.012_28)]">
                                                                {pt?.isFuture ? `~${pt?.forecast}` : (pt?.pax || 0)}
                                                            </span>
                                                            <span className="text-[oklch(42%_0.010_28)] ml-1">
                                                                / สถิติ ~{pt?.baselinePax || 0}
                                                            </span>
                                                        </>
                                                    )}
                                                </td>
                                                <td className={`p-2.5 text-right font-bold ${
                                                    isGoal ? 'text-[oklch(44%_0.17_142)]' : 'text-[oklch(18%_0.012_28)]'
                                                }`}>
                                                    <span>฿{(pt?.sale || 0).toLocaleString()}</span>
                                                    {isGoal && pt?.goalDeltaPct > 0 && (
                                                        <span className="text-[9px] ml-1 text-[oklch(50%_0.15_142)]">
                                                            (+{pt.goalDeltaPct}%)
                                                        </span>
                                                    )}
                                                    {filterMode === 'month' && (pt?.avgSales || 0) > 0 && (
                                                        <span className="text-[10px] font-normal text-[oklch(42%_0.010_28)] ml-1 font-sans">
                                                            (~฿{pt.avgSales.toLocaleString()}/วัน)
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-right text-[oklch(18%_0.012_28)]">
                                                    ฿{(pt?.cumulativeSales || 0).toLocaleString()}
                                                </td>
                                                <td className="p-2.5 text-right text-[oklch(45%_0.08_140)]">
                                                    ฿{(pt?.spendPerHead || 0).toLocaleString()}
                                                </td>
                                                <td className="p-2.5 text-right text-[oklch(42%_0.010_28)]">
                                                    {filterMode === 'month' ? (
                                                        <>
                                                            <span>{(pt?.bills || 0).toLocaleString()} บิล</span>
                                                            {(pt?.avgBills || 0) > 0 && (
                                                                <span className="text-[10px] ml-1 text-[oklch(55%_0.010_28)]">
                                                                    (~{pt.avgBills}/ว.)
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        `${pt?.bills || 0} บิล`
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-right">
                                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold ${
                                                        (pt?.seatOccupancyPct || 0) > 60
                                                            ? 'bg-[oklch(52%_0.16_28)] text-white'
                                                            : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)]'
                                                    }`}>
                                                        {pt?.seatOccupancyPct || 0}%
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot className="bg-[oklch(94%_0.010_28)] border-t-2 border-[oklch(85%_0.012_28)] font-bold text-[oklch(18%_0.012_28)]">
                                    <tr>
                                        <td className="p-2.5 uppercase tracking-wider">
                                            {filterMode === 'month' ? 'ยอดรวมทั้งเดือน' : 'ยอดรวมทั้งวัน'}
                                        </td>
                                        <td className="p-2.5 text-[oklch(42%_0.010_28)]">
                                            4 ช่วงเวลา
                                        </td>
                                        <td className="p-2.5 text-right">
                                            {filterMode === 'month' ? (
                                                <>
                                                    <span>{(monthMetrics?.monthPax || 0).toLocaleString()} ท่าน</span>
                                                    <span className="text-[oklch(42%_0.010_28)] ml-1 text-[10px] font-normal">
                                                        / เฉลี่ย ~{monthMetrics ? Math.round(monthMetrics.monthPax / monthMetrics.activeDaysCount) : 0}
                                                    </span>
                                                </>
                                            ) : (
                                                `${dayMetrics?.totalGuests || 0} ท่าน`
                                            )}
                                        </td>
                                        <td className="p-2.5 text-right text-[oklch(52%_0.16_28)]">
                                            ฿{(filterMode === 'month' ? (monthMetrics?.monthGross || 0) : (dayMetrics?.totalGross || 0)).toLocaleString()}
                                        </td>
                                        <td className="p-2.5 text-right">
                                            ฿{(filterMode === 'month' ? (monthMetrics?.monthGross || 0) : (dayMetrics?.totalGross || 0)).toLocaleString()}
                                        </td>
                                        <td className="p-2.5 text-right text-[oklch(45%_0.08_140)]">
                                            ฿{(() => {
                                                if (filterMode === 'month') {
                                                    return monthMetrics?.monthPax > 0 ? Math.round(monthMetrics.monthGross / monthMetrics.monthPax).toLocaleString() : '0'
                                                }
                                                return dayMetrics?.totalGuests > 0 ? Math.round(dayMetrics.totalGross / dayMetrics.totalGuests).toLocaleString() : '0'
                                            })()}
                                        </td>
                                        <td className="p-2.5 text-right text-[oklch(42%_0.010_28)]">
                                            {(filterMode === 'month' ? (monthMetrics?.monthBills || 0) : (dayMetrics?.points?.reduce((sum, p) => sum + (p.bills || 0), 0) || 0)).toLocaleString()} บิล
                                        </td>
                                        <td className="p-2.5 text-right text-[oklch(42%_0.010_28)]">
                                            {filterMode === 'month'
                                                ? `${Math.round(((monthMetrics?.monthPax || 0) / (Math.max(1, monthMetrics?.activeDaysCount || 1) * totalSeats * hours.length)) * 100)}%`
                                                : '—'}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 5. VIEW 3: ON-DEMAND AI STRATEGY & AD INTENT (When activeSubTab === 'ad_briefing') */}
            {/* ========================================================================= */}
            {filterMode === 'day' && activeSubTab === 'ad_briefing' && (
                <div className="p-4 md:p-6 bg-[oklch(95.5%_0.008_28)] space-y-6">
                    {/* Header Banner with Explicit AI Generation Button */}
                    <div className="p-4 md:p-5 bg-[oklch(97%_0.008_28)] border border-[oklch(88%_0.012_28)] rounded-2xl space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[oklch(88%_0.012_28)] pb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)]" />
                                    <h4 className="font-semibold text-sm md:text-base text-[oklch(18%_0.012_28)]">
                                        วิเคราะห์กลยุทธ์กะนี้ด้วย AI
                                    </h4>
                                </div>
                                <p className="text-xs text-[oklch(50%_0.010_28)] mt-0.5">
                                    สังเคราะห์ด้วย Gemini AI เฉพาะตอนที่กดปุ่มเท่านั้น
                                </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={generateAiBriefing}
                                    disabled={aiLoading}
                                    className="px-4 py-2 rounded-xl bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] font-medium text-xs transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {aiLoading ? 'กำลังประมวลผลข้อมูลกะ…' : (aiBriefing ? 'วิเคราะห์ใหม่' : 'สร้างบทวิเคราะห์ AI')}
                                </button>
                                {aiBriefing && (
                                    <button
                                        type="button"
                                        onClick={() => setAiBriefing(null)}
                                        className="px-3 py-2 rounded-xl bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)] text-xs text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] cursor-pointer transition-colors"
                                    >
                                        ล้าง
                                    </button>
                                )}
                            </div>
                        </div>

                        {aiBriefing ? (
                            <div className="space-y-3 pt-2">
                                {renderBriefingContent(aiBriefing)}
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={copyBriefingToClipboard}
                                        className="px-3 py-1.5 rounded-xl font-medium text-xs text-[oklch(18%_0.012_28)] bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)] hover:bg-[oklch(90%_0.012_28)] cursor-pointer transition-colors"
                                    >
                                        {copiedBriefing ? 'คัดลอกเรียบร้อยแล้ว' : 'คัดลอกบทวิเคราะห์'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center space-y-2">
                                <p className="text-xs text-[oklch(50%_0.010_28)]">
                                    ยังไม่มีบทวิเคราะห์ที่สร้างไว้ กดปุ่ม &ldquo;สร้างบทวิเคราะห์ AI&rdquo; เพื่อเริ่มสรุปข้อมูลความเร็วยอดขายและสัญญาณลูกค้าออนไลน์
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Ad & Search Intent Leads Funnel */}
                    <div className="border border-[oklch(88%_0.012_28)] bg-[oklch(97%_0.008_28)] rounded-2xl p-4 md:p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-[oklch(88%_0.012_28)] pb-2.5 flex-wrap gap-2">
                            <span className="font-semibold text-xs text-[oklch(18%_0.012_28)]">
                                สัญญาณความสนใจจากลูกค้าออนไลน์ ({adEvents.length} เหตุการณ์)
                            </span>
                            <span className="font-mono text-xs font-semibold text-[oklch(45%_0.08_140)] tabular-nums">
                                {dayMetrics?.adHighIntent} สัญญาณตั้งใจสูง
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                            <div className="p-3 rounded-xl bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)]">
                                <span className="text-[11px] text-[oklch(50%_0.010_28)] block">ขอเส้นทาง (Maps)</span>
                                <span className="font-mono text-lg font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                    {adEvents.filter(e => ['click_directions', 'find_location', 'directions'].includes(e.event_name)).length}
                                </span>
                            </div>
                            <div className="p-3 rounded-xl bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)]">
                                <span className="text-[11px] text-[oklch(50%_0.010_28)] block">โทร / LINE</span>
                                <span className="font-mono text-lg font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                    {adEvents.filter(e => ['click_phone', 'contact', 'call', 'click_line', 'generate_lead', 'line'].includes(e.event_name)).length}
                                </span>
                            </div>
                            <div className="p-3 rounded-xl bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)]">
                                <span className="text-[11px] text-[oklch(50%_0.010_28)] block">จองโต๊ะ / สั่งกลับ</span>
                                <span className="font-mono text-lg font-bold text-[oklch(45%_0.08_140)] tabular-nums">
                                    {adEvents.filter(e => ['click_booking_link', 'click_pickup_link', 'booking', 'pickup'].includes(e.event_name)).length}
                                </span>
                            </div>
                            <div className="p-3 rounded-xl bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)]">
                                <span className="text-[11px] text-[oklch(50%_0.010_28)] block">สำรวจเมนู / บรรยากาศ</span>
                                <span className="font-mono text-lg font-bold text-[oklch(52%_0.16_28)] tabular-nums">
                                    {adEvents.filter(e => ['view_menu', 'explore_menu', 'view_vibe', 'view_full_menu', 'view_booklet_menu', 'click_booklet', 'view_atmosphere', 'lightbox_open'].includes(e.event_name)).length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 6. VIEW 4: MONTH MODE VELOCITY RANKINGS (When monthViewMode === 'ranking') */}
            {/* ========================================================================= */}
            {filterMode === 'month' && monthViewMode === 'ranking' && (
                <div className="p-4 md:p-6 bg-[oklch(97%_0.008_28)] space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-[oklch(18%_0.012_28)]">
                            จัดอันดับวันยอดขายเด่นประจำเดือน
                        </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Top Fastest Days */}
                        <div className="border border-[oklch(88%_0.012_28)] bg-[oklch(95.5%_0.008_28)] rounded-2xl p-4 space-y-2.5">
                            <div className="text-xs font-semibold text-[oklch(45%_0.08_140)]">
                                5 อันดับวันที่ยอดขายพุ่งสูงสุด
                            </div>
                            <div className="space-y-1.5">
                                {monthMetrics?.topDays.map((d, idx) => (
                                    <div
                                        key={d.date}
                                        className="p-2.5 px-3 bg-[oklch(97%_0.008_28)] border border-[oklch(88%_0.012_28)] rounded-xl flex items-center justify-between font-mono text-xs tabular-nums"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-[oklch(18%_0.012_28)]">#{idx + 1}</span>
                                            <span>{d.date}</span>
                                            <span className="text-[10.5px] font-sans text-[oklch(50%_0.010_28)]">
                                                ({d.isWeekend ? 'วันหยุด' : 'วันธรรมดา'})
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-semibold text-[oklch(18%_0.012_28)]">฿{d.sales.toLocaleString()}</span>
                                            <span className="text-[10.5px] font-sans text-[oklch(50%_0.010_28)] ml-2">({d.pax} ท่าน)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sluggish Days for Optimization */}
                        <div className="border border-[oklch(88%_0.012_28)] bg-[oklch(95.5%_0.008_28)] rounded-2xl p-4 space-y-2.5">
                            <div className="text-xs font-semibold text-[oklch(52%_0.16_28)]">
                                วันที่ควรเพิ่มกิจกรรมกระตุ้นยอดขาย
                            </div>
                            <div className="space-y-1.5">
                                {monthMetrics?.slowDays.map((d, idx) => (
                                    <div
                                        key={d.date}
                                        className="p-2.5 px-3 bg-[oklch(97%_0.008_28)] border border-[oklch(88%_0.012_28)] rounded-xl flex items-center justify-between font-mono text-xs tabular-nums"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-[oklch(18%_0.012_28)]">#{idx + 1}</span>
                                            <span>{d.date}</span>
                                            <span className="text-[10.5px] font-sans text-[oklch(50%_0.010_28)]">
                                                ({d.isWeekend ? 'วันหยุด' : 'วันธรรมดา'})
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-semibold text-[oklch(52%_0.16_28)]">฿{d.sales.toLocaleString()}</span>
                                            <span className="text-[10.5px] font-sans text-[oklch(50%_0.010_28)] ml-2">({d.pax} ท่าน)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Summary 4 Daypart Mini Cards when on chart view */}
            {filterMode === 'day' && activeSubTab === 'chart' && (
                <div className="p-4 md:p-5 bg-[oklch(95.5%_0.008_28)] space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-[oklch(18%_0.012_28)]">
                            สรุป 4 ช่วงเวลาประจำวัน
                        </span>
                        <span className="text-[11px] text-[oklch(50%_0.010_28)]">
                            คลิกที่การ์ดเพื่อดูรายละเอียดรายชั่วโมง
                        </span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                        {dayMetrics?.daypartBreakdown.map((dp) => {
                            const statusLabel = dp.status === 'active'
                                ? 'กำลังขาย'
                                : dp.status === 'passed'
                                    ? 'จบช่วง'
                                    : 'ถัดไป'
                            return (
                                <button
                                    key={dp.id}
                                    type="button"
                                    onClick={() => setActiveSubTab('dayparts')}
                                    className="text-left p-3.5 bg-[oklch(97%_0.008_28)] border border-[oklch(88%_0.012_28)] hover:border-[oklch(52%_0.16_28)]/60 rounded-xl cursor-pointer transition-colors space-y-1.5"
                                >
                                    <div className="flex items-center justify-between gap-1.5">
                                        <span className="font-semibold text-xs text-[oklch(18%_0.012_28)] truncate">{dp.thaiLabel}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                                            dp.status === 'active'
                                                ? 'bg-[oklch(94%_0.02_140)] text-[oklch(35%_0.08_140)]'
                                                : 'bg-[oklch(94%_0.010_28)] text-[oklch(50%_0.010_28)]'
                                        }`}>
                                            {statusLabel}
                                        </span>
                                    </div>
                                    <div className="font-mono font-bold text-base text-[oklch(18%_0.012_28)] tabular-nums">
                                        ฿{dp.sales.toLocaleString()}
                                    </div>
                                    <div className="text-[11px] font-mono text-[oklch(50%_0.010_28)] flex justify-between tabular-nums">
                                        <span>จริง {dp.pax} ท่าน</span>
                                        <span>สถิติ ~{dp.baselinePax}</span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
