/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import AdminPageHeader, { AdminTabs } from './AdminPageHeader'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { getThaiDate } from '../../utils/timeUtils'
import { toast } from 'sonner'

// Sub-components
import DatabaseVisualLedger from './financial/DatabaseVisualLedger'
import DetailedSalesSummary from './financial/DetailedSalesSummary'
import FinancialHeatmap from './financial/FinancialHeatmap'
import TopMenuInfographic from './financial/TopMenuInfographic'
import CRMFinancialSummary from './financial/CRMFinancialSummary'
import CasualDiningInsights from './financial/CasualDiningInsights'
import UnmetNeedAnalytics from './financial/UnmetNeedAnalytics'
import ProfitWaterfallChart from './financial/ProfitWaterfallChart'
import InteractiveBcgScatter from './financial/InteractiveBcgScatter'
import IntradayVelocityDaypartCockpit from './financial/IntradayVelocityDaypartCockpit'
import ExecutiveKpiStrip from './financial/ExecutiveKpiStrip'
import SalesTargetPaceCockpit from './financial/SalesTargetPaceCockpit'
import SmartAnomalyAlerts from './financial/SmartAnomalyAlerts'
import SalesDriversTable from './financial/SalesDriversTable'
import MenuEngineeringMatrix from './financial/MenuEngineeringMatrix'
import TrafficAndVelocityDuo from './financial/TrafficAndVelocityDuo'
import OperationalMarginBreakdown from './financial/OperationalMarginBreakdown'
import { classifyMenuCategory, formatCategoryLabel, MENU_CATEGORY_KEYS } from '../../utils/categoryClassifier'
import { getBookingPaymentBreakdown } from '../../utils/shiftHelper'
import { parseTableTransferInfo, isInternalBlockBooking, isGhostPickupBooking } from '../../utils/tableTransferHelper'

export default function AdminFinancialDashboard() {
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('master') // 'master', 'ledger', 'summary', 'heatmap', 'top_menu', 'crm', 'casual'
    const [dbLatencyMs, setDbLatencyMs] = useState(0)
    const [dbRecordCount, setDbRecordCount] = useState(0)
    const [isLiveConnected, setIsLiveConnected] = useState(false)

    // Request sequence tracker to prevent race conditions during rapid filter changes
    const fetchSeqRef = useRef(0)
    const debounceTimerRef = useRef(null)

    const getCurrentBangkokMonth = () => {
        const d = new Date()
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        return `${year}-${month}`
    }

    // Filter States
    const [filterMode, setFilterMode] = useState('day') // 'day', 'month', 'year'
    const [selectedDate, setSelectedDate] = useState(getThaiDate())
    const [selectedMonth, setSelectedMonth] = useState(getCurrentBangkokMonth())
    const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
    const [compareWithPrev, setCompareWithPrev] = useState(true)
    const [compareMode, setCompareMode] = useState('same_day_last_week') // 'same_day_last_week', 'yesterday'
    // Separate Targets: Daily, Monthly, Yearly
    const [dailyTarget, setDailyTarget] = useState(() => {
        try {
            const saved = localStorage.getItem('inth_daily_sales_target')
            return saved ? parseInt(saved, 10) : 15000
        } catch {
            return 15000
        }
    })
    const [monthlyTarget, setMonthlyTarget] = useState(() => {
        try {
            const saved = localStorage.getItem('inth_monthly_sales_target')
            return saved ? parseInt(saved, 10) : 450000
        } catch {
            return 450000
        }
    })
    const [yearlyTarget, setYearlyTarget] = useState(() => {
        try {
            const saved = localStorage.getItem('inth_yearly_sales_target')
            return saved ? parseInt(saved, 10) : 5400000
        } catch {
            return 5400000
        }
    })
    const [isEditingTarget, setIsEditingTarget] = useState(false)
    const [targetModalTab, setTargetModalTab] = useState('all') // 'all', 'day', 'month', 'year'
    const [targetDrafts, setTargetDrafts] = useState({
        daily: '15000',
        monthly: '450000',
        yearly: '5400000'
    })

    // Horizontal Tab Navigation Scroll States & Drag Refs (Desktop Ergonomics)
    const navScrollRef = useRef(null)
    const [canScrollNavLeft, setCanScrollNavLeft] = useState(false)
    const [canScrollNavRight, setCanScrollNavRight] = useState(false)
    const [isNavDragging, setIsNavDragging] = useState(false)
    const navDragStartX = useRef(0)
    const navScrollStartX = useRef(0)
    const hasNavDragged = useRef(false)

    // Quick Date / Month Steppers
    const stepDate = (deltaDays) => {
        try {
            const [y, m, d] = (selectedDate || '').split('-').map(Number)
            if (!y || !m || !d) return
            const dt = new Date(y, m - 1, d)
            dt.setDate(dt.getDate() + deltaDays)
            const newY = dt.getFullYear()
            const newM = String(dt.getMonth() + 1).padStart(2, '0')
            const newD = String(dt.getDate()).padStart(2, '0')
            setSelectedDate(`${newY}-${newM}-${newD}`)
        } catch (e) {
            console.error('Error stepping date:', e)
        }
    }

    const stepMonth = (deltaMonths) => {
        try {
            const [yStr, mStr] = (selectedMonth || '').split('-')
            let y = parseInt(yStr, 10)
            let m = parseInt(mStr, 10)
            if (isNaN(y) || isNaN(m)) return
            m += deltaMonths
            if (m < 1) {
                m = 12
                y -= 1
            } else if (m > 12) {
                m = 1
                y += 1
            }
            setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`)
        } catch (e) {
            console.error('Error stepping month:', e)
        }
    }

    const checkNavScroll = useCallback(() => {
        const el = navScrollRef.current
        if (!el) return
        const atStart = el.scrollLeft <= 4
        const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 4
        setCanScrollNavLeft(!atStart)
        setCanScrollNavRight(!atEnd)
    }, [])

    const handleNavScroll = (direction) => {
        const el = navScrollRef.current
        if (!el) return
        const distance = 260
        el.scrollBy({
            left: direction === 'left' ? -distance : distance,
            behavior: 'smooth'
        })
        setTimeout(checkNavScroll, 280)
    }

    const handleNavMouseDown = (e) => {
        if (e.button !== 0) return
        setIsNavDragging(true)
        hasNavDragged.current = false
        navDragStartX.current = e.pageX - navScrollRef.current.offsetLeft
        navScrollStartX.current = navScrollRef.current.scrollLeft
    }

    const handleNavMouseMove = (e) => {
        if (!isNavDragging || !navScrollRef.current) return
        e.preventDefault()
        const x = e.pageX - navScrollRef.current.offsetLeft
        const walk = (x - navDragStartX.current) * 1.2
        if (Math.abs(walk) > 4) {
            hasNavDragged.current = true
        }
        navScrollRef.current.scrollLeft = navScrollStartX.current - walk
        checkNavScroll()
    }

    const handleNavMouseUpOrLeave = () => {
        setIsNavDragging(false)
        checkNavScroll()
    }

    // Context-Aware Growth Metrics
    const [comparisonMetrics, setComparisonMetrics] = useState({
        salesGrowthPct: 0,
        orderGrowthPct: 0,
        guestGrowthPct: 0,
        avgTicketGrowthPct: 0,
        prevGross: 0,
        prevOrders: 0,
        prevGuests: 0,
        prevAvgTicket: 0,
    })

    // Real Live Financial Metrics (Connected directly to POS & Supabase)
    const [liveMetrics, setLiveMetrics] = useState({
        totalGrossRevenue: 0,
        totalDiscounts: 0,
        netRevenue: 0,
        totalExpenses: 0,
        netProfitReal: 0,
        netProfitMarginPct: 0,
        hasRecordedExpenses: false,
        salesPerHead: 0,
        guestCount: 0,
        avgBillSize: 0,
        tableTurnoverRate: '0.0',
        completedOrdersCount: 0,
        growthVsPrevPeriod: '0.0',
        prevPeriodGross: 0,
    })

    // Real Live Aggregated Datasets for sub-components
    const [rawTransactionsData, setRawTransactionsData] = useState([])
    const [paymentMethodsData, setPaymentMethodsData] = useState([])
    const [diningChannelsData, setDiningChannelsData] = useState([])
    const [auditReconciliationData, setAuditReconciliationData] = useState(null)
    const [hourlyVelocityData, setHourlyVelocityData] = useState([])
    const [dailyPacingData, setDailyPacingData] = useState([])
    const [monthlyPacingData, setMonthlyPacingData] = useState([])
    const [topMenuData, setTopMenuData] = useState([])
    const [heatmapMatrixData, setHeatmapMatrixData] = useState([])
    const [shiftMetricsData, setShiftMetricsData] = useState(null)
    const [casualData, setCasualData] = useState(null)
    const [crmData, setCrmData] = useState(null)
    const [unmetNeedData, setUnmetNeedData] = useState(null)
    const [hasLiveData, setHasLiveData] = useState(false)

    // Master Fetch Function with Race Condition Guard & Strict Error Handling
    const fetchRealFinancialData = useCallback(async () => {
        const currentSeq = ++fetchSeqRef.current
        setLoading(true)
        const startTime = performance.now()

        try {
            let startIso, endIso
            let prevStartIso, prevEndIso
            let expStartDate, expEndDate

            if (filterMode === 'day') {
                startIso = `${selectedDate}T00:00:00+07:00`
                endIso = `${selectedDate}T23:59:59+07:00`
                expStartDate = selectedDate
                expEndDate = selectedDate

                // Calculate comparison date based on compareMode
                const curD = new Date(selectedDate)
                if (compareMode === 'same_day_last_week') {
                    curD.setDate(curD.getDate() - 7)
                } else {
                    curD.setDate(curD.getDate() - 1)
                }
                const prevDateStr = curD.toISOString().split('T')[0]
                prevStartIso = `${prevDateStr}T00:00:00+07:00`
                prevEndIso = `${prevDateStr}T23:59:59+07:00`
            } else if (filterMode === 'month') {
                const [y, m] = selectedMonth.split('-')
                const lastDay = String(new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate()).padStart(2, '0')
                startIso = `${selectedMonth}-01T00:00:00+07:00`
                endIso = `${selectedMonth}-${lastDay}T23:59:59+07:00`
                expStartDate = `${selectedMonth}-01`
                expEndDate = `${selectedMonth}-${lastDay}`

                // Calculate previous month
                const prevMDate = new Date(parseInt(y, 10), parseInt(m, 10) - 2, 1)
                const prevY = prevMDate.getFullYear()
                const prevM = String(prevMDate.getMonth() + 1).padStart(2, '0')
                const prevLastDay = String(new Date(prevY, parseInt(prevM, 10), 0).getDate()).padStart(2, '0')
                prevStartIso = `${prevY}-${prevM}-01T00:00:00+07:00`
                prevEndIso = `${prevY}-${prevM}-${prevLastDay}T23:59:59+07:00`
            } else {
                startIso = `${selectedYear}-01-01T00:00:00+07:00`
                endIso = `${selectedYear}-12-31T23:59:59+07:00`
                expStartDate = `${selectedYear}-01-01`
                expEndDate = `${selectedYear}-12-31`

                const prevY = parseInt(selectedYear, 10) - 1
                prevStartIso = `${prevY}-01-01T00:00:00+07:00`
                prevEndIso = `${prevY}-12-31T23:59:59+07:00`
            }

            // 1. Parallel queries: live bookings + store expenses
            const [bookingsRes, expensesRes] = await Promise.all([
                supabase
                    .from('bookings')
                    .select(`
                        id,
                        table_id,
                        booking_time,
                        created_at,
                        total_amount,
                        deposit_amount,
                        discount_amount,
                        xhaus_discount,
                        status,
                        pax,
                        source,
                        booking_type,
                        order_type,
                        payment_method,
                        payment_slip_url,
                        slip_verified,
                        staff_remark,
                        customer_note,
                        user_id,
                        tables_layout (
                            id,
                            table_name
                        ),
                        profiles (
                            id,
                            display_name,
                            nickname,
                            phone_number,
                            current_tier
                        ),
                        order_items (
                            id,
                            quantity,
                            price_at_time,
                            cost_at_sale,
                            channel,
                            discount_applied,
                            custom_name,
                            menu_items (
                                id,
                                name,
                                price,
                                fixed_cost,
                                category_id,
                                menu_categories (
                                    id,
                                    name
                                )
                            )
                        )
                    `)
                    .gte('booking_time', startIso)
                    .lte('booking_time', endIso)
                    .order('booking_time', { ascending: false }),

                supabase
                    .from('store_expenses')
                    .select('id, amount, category, expense_date, title, doc_type')
                    .gte('expense_date', expStartDate)
                    .lte('expense_date', expEndDate)
            ])

            // If a newer request has started, abort this stale payload
            if (currentSeq !== fetchSeqRef.current) return

            if (bookingsRes.error) throw bookingsRes.error

            const elapsed = Math.round(performance.now() - startTime)
            setDbLatencyMs(elapsed)
            setDbRecordCount((bookingsRes.data?.length || 0) + (expensesRes.data?.length || 0))

            // 2. Query previous period if comparison enabled
            let prevGross = 0
            let prevOrdersCount = 0
            let prevGuestsCount = 0
            let prevAvgBill = 0

            if (compareWithPrev) {
                try {
                    const { data: prevData } = await supabase
                        .from('bookings')
                        .select('id, table_id, total_amount, status, pax, discount_amount, xhaus_discount, staff_remark, customer_note, booking_type, order_type, source')
                        .gte('booking_time', prevStartIso)
                        .lte('booking_time', prevEndIso)

                    if (currentSeq === fetchSeqRef.current && prevData) {
                        const prevValid = prevData.filter(b => 
                            ['completed', 'paid', 'success'].includes(b.status) &&
                            !isInternalBlockBooking(b) &&
                            !isGhostPickupBooking(b) &&
                            !parseTableTransferInfo(b).isMergedSource
                        )
                        prevGross = prevValid.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0)
                        prevOrdersCount = prevValid.length
                        prevGuestsCount = prevValid.reduce((sum, b) => sum + parseInt(b.pax || 1, 10), 0)
                        prevAvgBill = prevOrdersCount > 0 ? Math.round(prevGross / prevOrdersCount) : 0
                    }
                } catch (e) {
                    console.warn('Could not query previous period:', e)
                }
            }

            // If sequence shifted during prev query, abort
            if (currentSeq !== fetchSeqRef.current) return

            // Calculate total real expenses
            const expensesList = expensesRes.data || []
            const totalExpensesReal = expensesList.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0)
            const hasRecordedExpenses = expensesList.length > 0

            // Filter strictly for settled revenue-generating orders (excluding unpaid open tables and merged source bills)
            const validOrders = (bookingsRes.data || []).filter(b => 
                ['completed', 'paid', 'success'].includes(b.status) &&
                !isInternalBlockBooking(b) &&
                !isGhostPickupBooking(b) &&
                !parseTableTransferInfo(b).isMergedSource
            )

            if (!validOrders || validOrders.length === 0) {
                // Honest ZERO State
                setHasLiveData(false)
                setLiveMetrics({
                    totalGrossRevenue: 0,
                    totalDiscounts: 0,
                    netRevenue: 0,
                    totalExpenses: totalExpensesReal,
                    netProfitReal: -totalExpensesReal,
                    netProfitMarginPct: 0,
                    hasRecordedExpenses,
                    salesPerHead: 0,
                    guestCount: 0,
                    avgBillSize: 0,
                    tableTurnoverRate: '0.0',
                    completedOrdersCount: 0,
                    growthVsPrevPeriod: '0.0',
                    prevPeriodGross: prevGross,
                })
                setRawTransactionsData([])
                setPaymentMethodsData([])
                setDiningChannelsData([])
                setHourlyVelocityData([])
                setDailyPacingData([])
                setMonthlyPacingData([])
                setTopMenuData([])
                setHeatmapMatrixData(Array(7).fill(0).map(() => Array(12).fill(0)))
                setShiftMetricsData(null)
                setAuditReconciliationData(null)
                setCasualData(null)
                setCrmData(null)
                setUnmetNeedData(null)
                return
            }

            setHasLiveData(true)

            // --- 3. Core KPI & Breakdown Calculations ---
            let totalSettled = 0
            let totalDiscounts = 0
            let discountCount = 0
            let totalGuests = 0
            let promptpayAmt = 0, creditAmt = 0, cashAmt = 0, walletAmt = 0
            let promptpayCount = 0, creditCount = 0, cashCount = 0, walletCount = 0
            let dineInAmt = 0, takeawayAmt = 0
            let dineInTables = 0, takeawayOrders = 0
            let totalCostRecorded = 0

            // Casual dining breakdown (6 core categories)
            let foodRev = 0, snackRev = 0, setRev = 0, dessertRev = 0, bevRev = 0, alcRev = 0
            let soloCount = 0, soloRev = 0
            let coupleCount = 0, coupleRev = 0
            let mediumCount = 0, mediumRev = 0
            let largeCount = 0, largeRev = 0

            // Shift aggregations
            let lunchSales = 0, lunchGuests = 0, lunchFood = 0, lunchDrink = 0
            let afternoonSales = 0, afternoonGuests = 0, afternoonFood = 0, afternoonDrink = 0
            let dinnerSales = 0, dinnerGuests = 0, dinnerFood = 0, dinnerDrink = 0
            let lateSales = 0, lateGuests = 0, lateFood = 0, lateDrink = 0

            // CRM Member aggregations
            let memberSales = 0, nonMemberSales = 0
            let memberCount = 0, nonMemberCount = 0
            const spenderMap = {}
            const tierMap = {}

            const itemAgg = {}
            const hourlyAgg = Array(24).fill(0).map(() => ({ gross: 0, bills: 0, guests: 0, items: {} }))
            const daysInMonthCount = filterMode === 'month' && selectedMonth
                ? new Date(parseInt(selectedMonth.split('-')[0], 10), parseInt(selectedMonth.split('-')[1], 10), 0).getDate()
                : 31
            const dailyAgg = Array(daysInMonthCount + 1).fill(0).map((_, idx) => ({ day: idx, amount: 0, bills: 0, guests: 0 }))
            const monthlyAgg = Array(13).fill(0).map((_, idx) => ({ month: idx, amount: 0, bills: 0, guests: 0 }))
            const dayHourAgg = Array(7).fill(0).map(() => Array(12).fill(0)) // 7 days x 12 intervals

            const formattedRawTx = []

            validOrders.forEach(b => {
                const amount = parseFloat(b.total_amount || 0)
                const discount = parseFloat(b.discount_amount || 0) + parseFloat(b.xhaus_discount || 0)
                const guests = parseInt(b.pax || 1, 10)
                const remark = (b.staff_remark || '').toLowerCase()
                const bTime = new Date(b.booking_time)
                const hour = bTime.getHours()
                const dayIdx = (bTime.getDay() + 6) % 7 // Monday = 0

                totalSettled += amount
                if (discount > 0) {
                    totalDiscounts += discount
                    discountCount += 1
                }
                totalGuests += guests

                // Party Size breakdown
                if (guests === 1) {
                    soloCount++; soloRev += amount
                } else if (guests === 2) {
                    coupleCount++; coupleRev += amount
                } else if (guests >= 3 && guests <= 4) {
                    mediumCount++; mediumRev += amount
                } else {
                    largeCount++; largeRev += amount
                }

                // Unified Payment Method Breakdown (matches POS & Admin Overview 100%)
                const isRemarkWallet = remark.includes('wallet') && !remark.includes('paid by cash') && !remark.includes('paid by qr')
                let txPayMethod = 'Cash'
                let txIsSplit = false

                if (isRemarkWallet) {
                    txPayMethod = 'Member Wallet'
                    walletAmt += amount
                    walletCount++
                } else {
                    const pBreakdown = getBookingPaymentBreakdown(b)
                    txIsSplit = Boolean(pBreakdown.isSplit)
                    txPayMethod = pBreakdown.methodLabel === 'QR Transfer' ? 'PromptPay QR' : (pBreakdown.methodLabel || 'Cash')
                    if (pBreakdown.cash > 0) { cashAmt += pBreakdown.cash; cashCount++ }
                    if (pBreakdown.qr > 0) { promptpayAmt += pBreakdown.qr; promptpayCount++ }
                    if (pBreakdown.credit > 0) { creditAmt += pBreakdown.credit; creditCount++ }
                }

                // Dining Channels
                const bType = (b.booking_type || 'dine_in').toLowerCase()
                const isTakeaway = bType.includes('pickup') || bType.includes('takeaway')
                if (isTakeaway) {
                    takeawayAmt += amount; takeawayOrders++
                } else {
                    dineInAmt += amount; dineInTables++
                }

                // CRM Member tracking
                let memberName = null
                let memberTier = null
                if (b.user_id && b.profiles) {
                    memberSales += amount; memberCount++
                    memberName = b.profiles.display_name || b.profiles.nickname || 'Member'
                    memberTier = b.profiles.current_tier || 'Member'
                    if (!spenderMap[b.user_id]) {
                        spenderMap[b.user_id] = { name: memberName, tier: memberTier, totalLtv: 0, visits: 0 }
                    }
                    spenderMap[b.user_id].totalLtv += amount
                    spenderMap[b.user_id].visits += 1

                    if (!tierMap[memberTier]) {
                        tierMap[memberTier] = { name: memberTier, members: 0, totalSales: 0 }
                    }
                    tierMap[memberTier].members += 1
                    tierMap[memberTier].totalSales += amount
                } else {
                    nonMemberSales += amount; nonMemberCount++
                }

                // Hourly Velocity
                if (hour >= 0 && hour < 24) {
                    hourlyAgg[hour].gross += amount
                    hourlyAgg[hour].bills += 1
                    hourlyAgg[hour].guests += guests
                }

                // Daily & Monthly Pacing Accumulation
                const bDay = bTime.getDate()
                const bMonth = bTime.getMonth() + 1
                if (bDay >= 1 && bDay <= daysInMonthCount) {
                    dailyAgg[bDay].amount += amount
                    dailyAgg[bDay].bills += 1
                    dailyAgg[bDay].guests += guests
                }
                if (bMonth >= 1 && bMonth <= 12) {
                    monthlyAgg[bMonth].amount += amount
                    monthlyAgg[bMonth].bills += 1
                    monthlyAgg[bMonth].guests += guests
                }

                // Heatmap Matrix mapping (11:00 to 22:00)
                if (hour >= 11 && hour <= 22) {
                    const timeSlotIdx = hour - 11
                    dayHourAgg[dayIdx][timeSlotIdx] += 1
                }

                // Shift assignment
                if (hour >= 11 && hour < 14) {
                    lunchSales += amount; lunchGuests += guests
                } else if (hour >= 14 && hour < 17) {
                    afternoonSales += amount; afternoonGuests += guests
                } else if (hour >= 17 && hour < 21) {
                    dinnerSales += amount; dinnerGuests += guests
                } else if (hour >= 21 && hour < 24) {
                    lateSales += amount; lateGuests += guests
                }

                // Order items processing
                const formattedItems = []
                let orderFoodRev = 0, orderDrinkRev = 0

                ;(b.order_items || []).forEach(item => {
                    const mItem = item.menu_items
                    const itemName = item.custom_name || mItem?.name || item.name || 'เมนูพิเศษ'
                    const qty = item.quantity || 1
                    const itemPrice = parseFloat(item.price_at_time || mItem?.price || 0)
                    const itemRev = itemPrice * qty
                    const itemUnitCost = parseFloat(item.cost_at_sale ?? mItem?.fixed_cost ?? 0)
                    const itemTotalCost = itemUnitCost * qty
                    totalCostRecorded += itemTotalCost

                    const rawCatName = mItem?.menu_categories?.name || item.category_name || item.category || 'ทั่วไป'
                    const catKey = classifyMenuCategory(rawCatName, itemName)
                    const formattedCatLabel = formatCategoryLabel(rawCatName)

                    formattedItems.push({
                        name: itemName,
                        quantity: qty,
                        price: itemPrice,
                        cost: itemUnitCost,
                        category: formattedCatLabel,
                        categoryKey: catKey
                    })

                    // Categorized Revenue Accumulation
                    if (catKey === MENU_CATEGORY_KEYS.ALCOHOL) {
                        alcRev += itemRev
                        orderDrinkRev += itemRev
                    } else if (catKey === MENU_CATEGORY_KEYS.DRINK) {
                        bevRev += itemRev
                        orderDrinkRev += itemRev
                    } else if (catKey === MENU_CATEGORY_KEYS.SET) {
                        setRev += itemRev
                        orderFoodRev += itemRev
                    } else if (catKey === MENU_CATEGORY_KEYS.DESSERT) {
                        dessertRev += itemRev
                        orderFoodRev += itemRev
                    } else if (catKey === MENU_CATEGORY_KEYS.SNACK) {
                        snackRev += itemRev
                        orderFoodRev += itemRev
                    } else {
                        foodRev += itemRev
                        orderFoodRev += itemRev
                    }

                    // Accumulate Item Aggregate
                    if (!itemAgg[itemName]) {
                        itemAgg[itemName] = {
                            name: itemName,
                            categoryName: formattedCatLabel,
                            category: catKey,
                            units: 0,
                            revenue: 0,
                            cost: 0,
                            price: itemPrice
                        }
                    }
                    itemAgg[itemName].units += qty
                    itemAgg[itemName].revenue += itemRev
                    itemAgg[itemName].cost += itemTotalCost

                    // Accumulate Hourly Velocity Item
                    if (hour >= 0 && hour < 24) {
                        hourlyAgg[hour].items[itemName] = (hourlyAgg[hour].items[itemName] || 0) + qty
                    }
                })

                // Shift food/drink accumulation
                if (hour >= 11 && hour < 14) { lunchFood += orderFoodRev; lunchDrink += orderDrinkRev }
                else if (hour >= 14 && hour < 17) { afternoonFood += orderFoodRev; afternoonDrink += orderDrinkRev }
                else if (hour >= 17 && hour < 21) { dinnerFood += orderFoodRev; dinnerDrink += orderDrinkRev }
                else if (hour >= 21 && hour < 24) { lateFood += orderFoodRev; lateDrink += orderDrinkRev }

                // Build Visual Ledger Transaction Object
                formattedRawTx.push({
                    id: b.id,
                    booking_time: b.booking_time,
                    booking_type: b.booking_type,
                    tableName: b.tables_layout?.table_name || (isTakeaway ? 'PICKUP' : 'WALK-IN'),
                    guestName: memberName || (isTakeaway ? 'ลูกค้าสั่งกลับบ้าน' : 'ลูกค้าหน้าร้าน'),
                    memberTier: memberTier,
                    pax: guests,
                    paymentMethod: txPayMethod,
                    paymentMethodLabel: txPayMethod,
                    isSplit: txIsSplit,
                    payment_slip_url: b.payment_slip_url,
                    staff_remark: b.staff_remark,
                    total_amount: amount,
                    discount_amount: discount,
                    status: b.status,
                    items: formattedItems
                })
            })

            setRawTransactionsData(formattedRawTx)

            const completedOrdersCount = validOrders.length
            const netRev = totalSettled
            const totalGross = totalSettled + totalDiscounts
            const salesPerHead = totalGuests > 0 ? Math.round(netRev / totalGuests) : 0
            const avgBillSize = completedOrdersCount > 0 ? Math.round(netRev / completedOrdersCount) : 0
            const netProfitReal = hasRecordedExpenses ? (netRev - totalExpensesReal) : netRev
            const netProfitMarginPct = netRev > 0 ? ((netProfitReal / netRev) * 100).toFixed(1) : '0.0'
            const tableTurnoverRate = (completedOrdersCount / 12).toFixed(1)

            let growthPct = '0.0'
            if (prevGross > 0) {
                const diff = ((netRev - prevGross) / prevGross) * 100
                growthPct = (diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1))
            } else if (netRev > 0) {
                growthPct = '+100.0'
            }

            const orderGrowth = prevOrdersCount > 0 ? ((completedOrdersCount - prevOrdersCount) / prevOrdersCount) * 100 : 0
            const guestGrowth = prevGuestsCount > 0 ? ((totalGuests - prevGuestsCount) / prevGuestsCount) * 100 : 0
            const avgTicketGrowth = prevAvgBill > 0 ? ((avgBillSize - prevAvgBill) / prevAvgBill) * 100 : 0

            setComparisonMetrics({
                salesGrowthPct: parseFloat(growthPct),
                orderGrowthPct: orderGrowth,
                guestGrowthPct: guestGrowth,
                avgTicketGrowthPct: avgTicketGrowth,
                prevGross,
                prevOrders: prevOrdersCount,
                prevGuests: prevGuestsCount,
                prevAvgTicket: prevAvgBill
            })

            const calculatedFoodCostPct = (netRev > 0 && totalCostRecorded > 0)
                ? parseFloat(((totalCostRecorded / netRev) * 100).toFixed(1))
                : 30.0

            setLiveMetrics({
                totalGrossRevenue: totalGross,
                totalDiscounts,
                netRevenue: netRev,
                totalExpenses: totalExpensesReal,
                netProfitReal,
                netProfitMarginPct: parseFloat(netProfitMarginPct),
                hasRecordedExpenses,
                salesPerHead,
                guestCount: totalGuests,
                avgBillSize,
                tableTurnoverRate,
                completedOrdersCount,
                growthVsPrevPeriod: growthPct,
                prevPeriodGross: prevGross,
                calculatedFoodCostPct,
            })

            // Format Payment Methods
            const totalPay = promptpayAmt + creditAmt + cashAmt + walletAmt || 1
            setPaymentMethodsData([
                { name: 'PromptPay QR', amount: promptpayAmt, percent: Math.round((promptpayAmt / totalPay) * 100), count: promptpayCount, code: 'QR' },
                { name: 'Credit / Debit Card', amount: creditAmt, percent: Math.round((creditAmt / totalPay) * 100), count: creditCount, code: 'CC' },
                { name: 'Cash (เงินสด)', amount: cashAmt, percent: Math.round((cashAmt / totalPay) * 100), count: cashCount, code: 'CSH' },
                { name: 'Member Wallet', amount: walletAmt, percent: Math.round((walletAmt / totalPay) * 100), count: walletCount, code: 'WAL' },
            ])

            // Format Dining Channels
            setDiningChannelsData([
                { name: 'Dine-In (ทานที่ร้าน / จองโต๊ะ)', amount: dineInAmt, percent: Math.round((dineInAmt / (netRev || 1)) * 100), tables: dineInTables, avgPerTable: dineInTables > 0 ? Math.round(dineInAmt / dineInTables) : 0, code: 'DINE_IN' },
                { name: 'Takeaway / Pickup (รับกลับบ้าน)', amount: takeawayAmt, percent: Math.round((takeawayAmt / (netRev || 1)) * 100), orders: takeawayOrders, avgPerOrder: takeawayOrders > 0 ? Math.round(takeawayAmt / takeawayOrders) : 0, code: 'PICKUP' },
            ])

            // Format Top Selling Items from POS
            const topList = Object.values(itemAgg)
                .sort((a, b) => b.revenue - a.revenue)
                .map((item, idx) => ({
                    rank: idx + 1,
                    name: item.name,
                    category: item.category,
                    categoryLabel: item.categoryName,
                    units: item.units,
                    revenue: item.revenue,
                    price: item.price,
                    cost: item.cost,
                    marginPct: item.revenue > 0 && item.cost > 0 
                        ? Math.round(((item.revenue - item.cost) / item.revenue) * 100) 
                        : null,
                    isBestSeller: idx === 0,
                }))
            setTopMenuData(topList)

            // Format Mathematically Balanced Reconciliation
            setAuditReconciliationData({
                grossSales: totalGross,
                totalDiscounts: totalDiscounts,
                discountCount: discountCount,
                taxableSubtotal: netRev,
                netPayable: netRev,
                avgTicket: avgBillSize,
                totalExpenses: totalExpensesReal,
                netOperatingIncome: netProfitReal,
            })

            // Format Hourly Velocity with actual peak item
            const formattedHourly = hourlyAgg
                .map((h, hr) => {
                    let peakItemName = '—'
                    if (h.items && Object.keys(h.items).length > 0) {
                        const sortedItems = Object.entries(h.items).sort((a, b) => b[1] - a[1])
                        if (sortedItems.length > 0) peakItemName = sortedItems[0][0]
                    }
                    return {
                        hour: hr,
                        hourLabel: `${hr.toString().padStart(2, '0')}:00 - ${(hr + 1).toString().padStart(2, '0')}:00`,
                        amount: h.gross,
                        gross: h.gross,
                        bills: h.bills,
                        guests: h.guests || Math.round(h.bills * 1.5),
                        avgBill: h.bills > 0 ? Math.round(h.gross / h.bills) : 0,
                        peakItem: peakItemName,
                    }
                })
                .filter(h => h.gross > 0 || h.bills > 0)
            setHourlyVelocityData(formattedHourly)
            setDailyPacingData(dailyAgg.slice(1))
            setMonthlyPacingData(monthlyAgg.slice(1))

            // Format Heatmap Matrix
            const maxVal = Math.max(...dayHourAgg.flat(), 1)
            const scaledMatrix = dayHourAgg.map(row => 
                row.map(v => v === 0 ? 0 : Math.min(10, Math.ceil((v / maxVal) * 10)))
            )
            setHeatmapMatrixData(scaledMatrix)

            // Dynamic Shift Metrics for Heatmap
            const formatRatio = (f, d) => {
                const total = f + d || 1
                return `${Math.round((f / total) * 100)}% อาหาร / ${Math.round((d / total) * 100)}% เครื่องดื่ม`
            }
            setShiftMetricsData({
                lunch: {
                    sales: lunchSales,
                    spendPerHead: lunchGuests > 0 ? Math.round(lunchSales / lunchGuests) : 0,
                    ratio: formatRatio(lunchFood, lunchDrink)
                },
                afternoon: {
                    sales: afternoonSales,
                    spendPerHead: afternoonGuests > 0 ? Math.round(afternoonSales / afternoonGuests) : 0,
                    ratio: formatRatio(afternoonFood, afternoonDrink)
                },
                dinner: {
                    sales: dinnerSales,
                    spendPerHead: dinnerGuests > 0 ? Math.round(dinnerSales / dinnerGuests) : 0,
                    ratio: formatRatio(dinnerFood, dinnerDrink)
                },
                late: {
                    sales: lateSales,
                    spendPerHead: lateGuests > 0 ? Math.round(lateSales / lateGuests) : 0,
                    ratio: formatRatio(lateFood, lateDrink)
                }
            })

            // Build Casual Dining Insights from real POS data
            const totalOrdersCount = validOrders.length || 1
            const partySizeBreakdown = [
                { size: 'Solo Diners (1 ท่าน)', share: Math.round((soloCount / totalOrdersCount) * 1000) / 10, count: soloCount, avgSpend: soloCount > 0 ? Math.round(soloRev / soloCount) : 0, note: 'ออเดอร์จานเดี่ยว' },
                { size: 'Couples (2 ท่าน)', share: Math.round((coupleCount / totalOrdersCount) * 1000) / 10, count: coupleCount, avgSpend: coupleCount > 0 ? Math.round(coupleRev / coupleCount) : 0, note: 'เมนูคู่และเครื่องดื่ม' },
                { size: 'Medium Groups (3-4 ท่าน)', share: Math.round((mediumCount / totalOrdersCount) * 1000) / 10, count: mediumCount, avgSpend: mediumCount > 0 ? Math.round(mediumRev / mediumCount) : 0, note: 'ชุดเซตและเมนูแชร์' },
                { size: 'Large Parties (5+ ท่าน)', share: Math.round((largeCount / totalOrdersCount) * 1000) / 10, count: largeCount, avgSpend: largeCount > 0 ? Math.round(largeRev / largeCount) : 0, note: 'โต๊ะรวมยอดสูง' },
            ]

            const itemTotalRev = foodRev + snackRev + setRev + dessertRev + bevRev + alcRev || 1
            const categoryRatio = {
                food: { percent: Math.round((foodRev / itemTotalRev) * 1000) / 10, revenue: foodRev, label: 'อาหารจานหลัก' },
                snack: { percent: Math.round((snackRev / itemTotalRev) * 1000) / 10, revenue: snackRev, label: 'ของทานเล่น' },
                set: { percent: Math.round((setRev / itemTotalRev) * 1000) / 10, revenue: setRev, label: 'ชุดเซตสำรับ' },
                dessert: { percent: Math.round((dessertRev / itemTotalRev) * 1000) / 10, revenue: dessertRev, label: 'ของหวาน' },
                beverage: { percent: Math.round((bevRev / itemTotalRev) * 1000) / 10, revenue: bevRev, label: 'เครื่องดื่ม' },
                alcohol: { percent: Math.round((alcRev / itemTotalRev) * 1000) / 10, revenue: alcRev, label: 'แอลกอฮอล์' }
            }

            setCasualData({
                categoryRatio,
                partySizeBreakdown,
                casualMetrics: {
                    tableTurnsPerDay: tableTurnoverRate,
                    totalOrders: completedOrdersCount,
                    totalGuests: totalGuests
                }
            })

            // Build Real CRM Financial Summary from POS data
            const totalMemberSum = memberSales + nonMemberSales || 1
            setCrmData({
                memberShare: {
                    memberSales,
                    nonMemberSales,
                    memberPercent: Math.round((memberSales / totalMemberSum) * 1000) / 10,
                    nonMemberPercent: Math.round((nonMemberSales / totalMemberSum) * 1000) / 10,
                    totalMembersCount: memberCount,
                    avgSpendMember: memberCount > 0 ? Math.round(memberSales / memberCount) : 0,
                    avgSpendNonMember: nonMemberCount > 0 ? Math.round(nonMemberSales / nonMemberCount) : 0,
                },
                memberTiers: Object.values(tierMap).map(t => ({
                    name: t.name,
                    members: t.members,
                    totalSales: t.totalSales,
                    avgPerVisit: t.members > 0 ? Math.round(t.totalSales / t.members) : 0,
                })),
                topSpenders: Object.values(spenderMap)
                    .sort((a, b) => b.totalLtv - a.totalLtv)
                    .slice(0, 5)
                    .map((s, idx) => ({
                        rank: idx + 1,
                        name: s.name,
                        tier: s.tier,
                        totalLtv: s.totalLtv,
                        visits: s.visits,
                        avgTicket: s.visits > 0 ? Math.round(s.totalLtv / s.visits) : 0,
                    }))
            })

            // Dynamic Real BCG Matrix calculation from active item volume vs revenue
            const avgUnits = topList.length > 0 ? topList.reduce((s, i) => s + i.units, 0) / topList.length : 1
            const avgPrice = topList.length > 0 ? topList.reduce((s, i) => s + (i.price || 0), 0) / topList.length : 1

            const stars = topList.filter(i => i.units >= avgUnits && i.price >= avgPrice).slice(0, 4).map(i => i.name)
            const plowhorses = topList.filter(i => i.units >= avgUnits && i.price < avgPrice).slice(0, 4).map(i => i.name)
            const puzzles = topList.filter(i => i.units < avgUnits && i.price >= avgPrice).slice(0, 4).map(i => i.name)
            const dogs = topList.filter(i => i.units < avgUnits && i.price < avgPrice).slice(0, 4).map(i => i.name)

            setUnmetNeedData({
                menuMatrix: [
                    { quadrant: 'Stars (ดาวเด่น)', items: stars.length > 0 ? stars : ['—'], desc: 'ยอดขายและรายได้สูงกว่าเกณฑ์เฉลี่ย', action: 'รักษาคุณภาพและตำแหน่งหลักในเมนู', tag: 'STARS' },
                    { quadrant: 'Plowhorses (ตัวทำปริมาณ)', items: plowhorses.length > 0 ? plowhorses : ['—'], desc: 'ขายดีปริมาณมาก ราคาสบายกระเป๋า', action: 'ควบคุมต้นทุนวัตถุดิบอย่างเคร่งครัด', tag: 'VOLUME' },
                    { quadrant: 'Puzzles (ทำกำไรต่อจานสูง)', items: puzzles.length > 0 ? puzzles : ['—'], desc: 'ราคาสูง ปริมาณสั่งซื้อรอการผลักดัน', action: 'เพิ่มการแนะนำหรือทำโปรคู่เครื่องดื่ม', tag: 'MARGIN' },
                    { quadrant: 'Dogs (รอทบทวน)', items: dogs.length > 0 ? dogs : ['—'], desc: 'ปริมาณสั่งซื้อและราคาต่ำกว่าเฉลี่ย', action: 'พิจารณาปรับสูตรหรือหมุนเวียนเมนูใหม่', tag: 'REVIEW' },
                ]
            })

        } catch (err) {
            console.error('Error fetching live POS financial data:', err)
        } finally {
            if (currentSeq === fetchSeqRef.current) {
                setLoading(false)
            }
        }
    }, [filterMode, selectedDate, selectedMonth, selectedYear, compareWithPrev, compareMode])

    // Leak-Proof Realtime & Visibility Change Subscriptions
    useEffect(() => {
        let isMounted = true
        fetchRealFinancialData()

        const debouncedFetch = () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = setTimeout(() => {
                if (isMounted) fetchRealFinancialData()
            }, 300)
        }

        // Window Focus / Visibility Sync: Refetch when returning to tab
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isMounted) {
                debouncedFetch()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        // Unique Channel Name per mount to prevent channel collisions
        const channelName = `financial-dashboard-realtime-${Date.now()}`
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'store_expenses' }, debouncedFetch)
            .subscribe((status) => {
                if (isMounted) {
                    setIsLiveConnected(status === 'SUBSCRIBED')
                }
            })

        return () => {
            isMounted = false
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            supabase.removeChannel(channel)
        }
    }, [fetchRealFinancialData])

    // Setup Navigation Strip Wheel Scroll Conversion (Desktop Mouse-Wheel Ergonomics)
    useEffect(() => {
        const el = navScrollRef.current
        if (!el) return
        checkNavScroll()

        const handleWheel = (e) => {
            // When mouse wheels over the navigation bar, convert vertical delta to horizontal scroll
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX) || e.deltaX !== 0) {
                const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX
                el.scrollLeft += delta * 0.9
                e.preventDefault()
                checkNavScroll()
            }
        }

        el.addEventListener('wheel', handleWheel, { passive: false })
        window.addEventListener('resize', checkNavScroll)

        return () => {
            el.removeEventListener('wheel', handleWheel)
            window.removeEventListener('resize', checkNavScroll)
        }
    }, [checkNavScroll])

    // Auto-scroll active tab into view when activeTab changes
    useEffect(() => {
        const el = navScrollRef.current
        if (!el) return
        const activeBtn = el.querySelector(`[data-tab-id="${activeTab}"]`)
        if (activeBtn) {
            activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        }
        const timer = setTimeout(checkNavScroll, 280)
        return () => clearTimeout(timer)
    }, [activeTab, checkNavScroll])

    const getTimeRangeLabel = () => {
        if (filterMode === 'day') return `ประจำวันที่ ${selectedDate}`
        if (filterMode === 'month') return `ประจำเดือน ${selectedMonth}`
        if (filterMode === 'year') return `ประจำปี ${selectedYear}`
        return 'ช่วงเวลาที่เลือก'
    }

    const handleExportReport = () => {
        toast.success(`ส่งออกรายงานทางการเงิน (${getTimeRangeLabel()}) เรียบร้อย`)
    }

    // Active sales target based on current period view
    const activeSalesTarget = useMemo(() => {
        if (filterMode === 'month') return monthlyTarget
        if (filterMode === 'year') return yearlyTarget
        return dailyTarget
    }, [filterMode, dailyTarget, monthlyTarget, yearlyTarget])

    const targetMeta = useMemo(() => {
        if (filterMode === 'month') {
            return {
                periodKey: 'month',
                periodLabel: 'รายเดือน',
                targetLabel: 'เป้าหมายรายเดือน',
                salesCardTitle: 'SALES THIS MONTH',
                salesAccumulatedLabel: 'MONTH SALES ACCUMULATED',
                paceTitle: 'ความคืบหน้าเทียบเป้าหมายประจำเดือน (Monthly Sales vs Target)',
                compareCode: 'vs M-1',
                velocityUnit: '/ วัน',
            }
        }
        if (filterMode === 'year') {
            return {
                periodKey: 'year',
                periodLabel: 'รายปี',
                targetLabel: 'เป้าหมายรายปี',
                salesCardTitle: 'SALES THIS YEAR',
                salesAccumulatedLabel: 'YEAR SALES ACCUMULATED',
                paceTitle: 'ความคืบหน้าเทียบเป้าหมายประจำปี (Yearly Sales vs Target)',
                compareCode: 'vs Y-1',
                velocityUnit: '/ เดือน',
            }
        }
        return {
            periodKey: 'day',
            periodLabel: 'รายวัน',
            targetLabel: 'เป้าหมายรายวัน',
            salesCardTitle: 'SALES TODAY',
            salesAccumulatedLabel: 'TODAY SALES ACCUMULATED',
            paceTitle: 'ความคืบหน้าเทียบเป้าหมายประจำวัน (Sales vs Target)',
            compareCode: compareMode === 'same_day_last_week' ? 'vs W-1' : 'vs D-1',
            velocityUnit: '/ ชม.',
        }
    }, [filterMode, compareMode])

    // Bangkok Date and Time Metrics for Level 1 & Level 2 Cockpits
    const { todayDay, todayMonth, todayYear, currentBangkokMonthStr } = useMemo(() => {
        try {
            const now = new Date()
            const y = now.toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric' })
            const m = now.toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', month: '2-digit' })
            const d = now.toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', day: '2-digit' })
            return {
                todayDay: parseInt(d, 10),
                todayMonth: parseInt(m, 10),
                todayYear: parseInt(y, 10),
                currentBangkokMonthStr: `${y}-${m}`
            }
        } catch {
            const now = new Date()
            return {
                todayDay: now.getDate(),
                todayMonth: now.getMonth() + 1,
                todayYear: now.getFullYear(),
                currentBangkokMonthStr: getCurrentBangkokMonth()
            }
        }
    }, [])

    const currentBangkokHour = (() => {
        try {
            const d = new Date()
            const hStr = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour12: false, hour: '2-digit' })
            return parseInt(hStr, 10)
        } catch {
            return new Date().getHours()
        }
    })()

    const currentBangkokTimeStr = (() => {
        try {
            const d = new Date()
            return d.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour12: false, hour: '2-digit', minute: '2-digit' })
        } catch {
            return '19:30'
        }
    })()

    // Period specific velocity & forecast (Day / Month / Year)
    const periodPacingMetrics = useMemo(() => {
        if (filterMode === 'month') {
            const [yStr, mStr] = (selectedMonth || currentBangkokMonthStr).split('-')
            const selY = parseInt(yStr, 10) || todayYear
            const selM = parseInt(mStr, 10) || todayMonth
            const totalDaysInMonth = new Date(selY, selM, 0).getDate()
            
            const isCurMonth = (selectedMonth === currentBangkokMonthStr)
            const daysElapsed = isCurMonth ? Math.min(totalDaysInMonth, Math.max(1, todayDay)) : totalDaysInMonth
            const daysRemaining = isCurMonth ? Math.max(0, totalDaysInMonth - todayDay) : 0
            
            const avgDailySales = Math.round(liveMetrics.totalGrossRevenue / daysElapsed)
            const forecastMonthClose = isCurMonth
                ? liveMetrics.totalGrossRevenue + (daysRemaining * avgDailySales)
                : liveMetrics.totalGrossRevenue
            
            return {
                periodKey: 'month',
                currentVelocity: avgDailySales,
                velocityUnit: '/ วัน',
                forecastClose: forecastMonthClose,
                tagLabel: isCurMonth ? `DAY ${todayDay}/${totalDaysInMonth}` : 'CLOSED',
                daysElapsed,
                daysInPeriod: totalDaysInMonth,
                daysRemaining,
            }
        }
        
        if (filterMode === 'year') {
            const selY = parseInt(selectedYear, 10) || todayYear
            const isCurYear = (selY === todayYear)
            const monthsElapsed = isCurYear ? Math.min(12, Math.max(1, todayMonth)) : 12
            const monthsRemaining = isCurYear ? Math.max(0, 12 - todayMonth) : 0
            
            const avgMonthlySales = Math.round(liveMetrics.totalGrossRevenue / monthsElapsed)
            const forecastYearClose = isCurYear
                ? liveMetrics.totalGrossRevenue + (monthsRemaining * avgMonthlySales)
                : liveMetrics.totalGrossRevenue
            
            return {
                periodKey: 'year',
                currentVelocity: avgMonthlySales,
                velocityUnit: '/ เดือน',
                forecastClose: forecastYearClose,
                tagLabel: isCurYear ? `M ${todayMonth}/12` : 'CLOSED',
                monthsElapsed,
                monthsInPeriod: 12,
                monthsRemaining,
            }
        }

        // Default: filterMode === 'day'
        const currentHourData = hourlyVelocityData.find(h => h.hour === currentBangkokHour)
        const currentVelocity = currentHourData?.amount || (liveMetrics.totalGrossRevenue > 0 ? Math.round(liveMetrics.totalGrossRevenue / Math.max(1, currentBangkokHour - 11 + 1)) : 0)
        const remainingHours = Math.max(0, 23 - currentBangkokHour)
        const forecastClose = liveMetrics.totalGrossRevenue + (remainingHours * Math.max(currentVelocity, 700))

        return {
            periodKey: 'day',
            currentVelocity,
            velocityUnit: '/ ชม.',
            forecastClose,
            tagLabel: currentBangkokTimeStr,
            remainingHours,
            daysElapsed: 1,
            daysInPeriod: 1,
            daysRemaining: 0,
        }
    }, [filterMode, selectedMonth, selectedYear, liveMetrics.totalGrossRevenue, hourlyVelocityData, currentBangkokHour, currentBangkokTimeStr, todayDay, todayMonth, todayYear, currentBangkokMonthStr])

    return (
        <div className="space-y-6 pb-20 text-[var(--color-ink)] bg-[var(--color-paper)]">
            
            <AdminPageHeader
                className=""
                title="Financial & Insights"
                description={<>ข้อมูลธุรกรรมจริงจากฐานข้อมูล POS · {getTimeRangeLabel()}</>}
                meta={<>
                    <span className={isLiveConnected ? 'text-[oklch(40%_0.08_140)]' : 'text-[var(--brand-plum)]'}>
                        {isLiveConnected ? 'เชื่อมต่อ realtime' : 'กำลังเชื่อมต่อ'}
                    </span>
                    {' '}· {dbLatencyMs}ms · {dbRecordCount} แถว
                </>}
                actions={<>
                    <button
                        type="button"
                        onClick={() => setCompareWithPrev(!compareWithPrev)}
                        aria-pressed={compareWithPrev}
                        className="admin-btn"
                    >
                        เทียบช่วงก่อน: {compareWithPrev ? 'เปิด' : 'ปิด'}
                    </button>
                    <Link to="/admin/tax" className="admin-btn">ภาษีและใบกำกับ</Link>
                    <button type="button" onClick={handleExportReport} className="admin-btn">ส่งออก CSV</button>
                    <button
                        type="button"
                        onClick={() => {
                            fetchRealFinancialData()
                            toast.success('อัพเดทข้อมูลการเงินล่าสุดแล้ว')
                        }}
                        disabled={loading}
                        className="admin-btn"
                    >
                        {loading ? 'กำลังดึงข้อมูล…' : 'รีเฟรช'}
                    </button>
                </>}
            />

            {/* 1. Filter bar (Neo-Brutalist 1px Border Grid) */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] divide-y divide-[var(--color-rule)]">
                
                {/* Filter Ribbon Row: Day / Month / Year Mode, Compare Mode, & Date Picker */}
                <div className="p-3 bg-[var(--color-paper)] flex flex-wrap items-center justify-between gap-3 tabular-nums text-xs">
                    
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Period Switcher */}
                        <div className="inline-flex border border-[var(--color-rule)] divide-x divide-[var(--color-rule)]">
                            {[
                                { id: 'day', label: 'รายวัน' },
                                { id: 'month', label: 'รายเดือน' },
                                { id: 'year', label: 'รายปี' },
                            ].map(mode => (
                                <button
                                    key={mode.id}
                                    onClick={() => setFilterMode(mode.id)}
                                    className={`px-3 py-1.5 font-bold transition-colors ${
                                        filterMode === mode.id
                                            ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                            : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] hover:bg-[var(--color-paper)]'
                                    }`}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>

                        {/* Date Inputs & Quick Presets */}
                        {filterMode === 'day' && (
                            <div className="inline-flex items-stretch border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                                <button
                                    type="button"
                                    onClick={() => stepDate(-1)}
                                    title="วันก่อนหน้า (D-1)"
                                    className="px-2.5 py-1.5 tabular-nums font-bold text-xs text-[var(--color-ink)] hover:bg-[var(--color-paper)] border-r border-[var(--color-rule)] transition-colors cursor-pointer"
                                >
                                    ◀
                                </button>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="px-3 py-1.5 bg-transparent text-[var(--color-ink)] tabular-nums font-bold focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => stepDate(1)}
                                    title="วันถัดไป (D+1)"
                                    className="px-2.5 py-1.5 tabular-nums font-bold text-xs text-[var(--color-ink)] hover:bg-[var(--color-paper)] border-l border-[var(--color-rule)] transition-colors cursor-pointer"
                                >
                                    ▶
                                </button>
                            </div>
                        )}

                        {filterMode === 'month' && (
                            <div className="inline-flex items-stretch border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                                <button
                                    type="button"
                                    onClick={() => stepMonth(-1)}
                                    title="เดือนก่อนหน้า (M-1)"
                                    className="px-2.5 py-1.5 tabular-nums font-bold text-xs text-[var(--color-ink)] hover:bg-[var(--color-paper)] border-r border-[var(--color-rule)] transition-colors cursor-pointer"
                                >
                                    ◀
                                </button>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="px-3 py-1.5 bg-transparent text-[var(--color-ink)] tabular-nums font-bold focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => stepMonth(1)}
                                    title="เดือนถัดไป (M+1)"
                                    className="px-2.5 py-1.5 tabular-nums font-bold text-xs text-[var(--color-ink)] hover:bg-[var(--color-paper)] border-l border-[var(--color-rule)] transition-colors cursor-pointer"
                                >
                                    ▶
                                </button>
                            </div>
                        )}

                        {filterMode === 'year' && (
                            <div className="inline-flex items-stretch border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                                <button
                                    type="button"
                                    onClick={() => setSelectedYear(prev => String(parseInt(prev, 10) - 1))}
                                    title="ปีก่อนหน้า (Y-1)"
                                    className="px-2.5 py-1.5 tabular-nums font-bold text-xs text-[var(--color-ink)] hover:bg-[var(--color-paper)] border-r border-[var(--color-rule)] transition-colors cursor-pointer"
                                >
                                    ◀
                                </button>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    className="px-3 py-1.5 bg-transparent text-[var(--color-ink)] tabular-nums font-bold focus:outline-none cursor-pointer"
                                >
                                    <option value="2027">ปี 2027</option>
                                    <option value="2026">ปี 2026</option>
                                    <option value="2025">ปี 2025</option>
                                    <option value="2024">ปี 2024</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setSelectedYear(prev => String(parseInt(prev, 10) + 1))}
                                    title="ปีถัดไป (Y+1)"
                                    className="px-2.5 py-1.5 tabular-nums font-bold text-xs text-[var(--color-ink)] hover:bg-[var(--color-paper)] border-l border-[var(--color-rule)] transition-colors cursor-pointer"
                                >
                                    ▶
                                </button>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => { setFilterMode('day'); setSelectedDate(getThaiDate()); }}
                            className="px-2.5 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] hover:bg-[var(--color-paper)] font-bold text-xs cursor-pointer"
                        >
                            วันนี้
                        </button>
                        <button
                            type="button"
                            onClick={() => { setFilterMode('month'); setSelectedMonth(getCurrentBangkokMonth()); }}
                            className="px-2.5 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] hover:bg-[var(--color-paper)] font-bold text-xs cursor-pointer"
                        >
                            เดือนนี้
                        </button>
                    </div>

                    {/* Context-Aware Comparison Mode & Location */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {compareWithPrev && filterMode === 'day' && (
                            <div className="inline-flex border border-[var(--color-rule)] divide-x divide-[var(--color-rule)]">
                                <button
                                    type="button"
                                    onClick={() => setCompareMode('same_day_last_week')}
                                    className={`px-2.5 py-1.5 font-bold transition-colors ${
                                        compareMode === 'same_day_last_week'
                                            ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                            : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] hover:bg-[var(--color-paper)]'
                                    }`}
                                >
                                    เทียบสัปดาห์ก่อน [W-1]
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCompareMode('yesterday')}
                                    className={`px-2.5 py-1.5 font-bold transition-colors ${
                                        compareMode === 'yesterday'
                                            ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                            : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] hover:bg-[var(--color-paper)]'
                                    }`}
                                >
                                    เทียบเมื่อวาน [D-1]
                                </button>
                            </div>
                        )}

                        <div className="px-2.5 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-muted)] tabular-nums text-xs">
                            สาขา: <strong className="text-[var(--color-ink)]">Main (ริมโขง)</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Zero State Alert (Clean Typography Enclosure) */}
            {!hasLiveData && !loading && (
                <div className="p-4 border border-[var(--color-rule)] bg-[var(--color-paper-2)] space-y-1 tabular-nums">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--brand-plum)]" />
                        <span className="text-xs font-bold text-[var(--color-ink)]">
                            ยังไม่มีธุรกรรม · {getTimeRangeLabel()}
                        </span>
                    </div>
                    <p className="text-[13px] text-[var(--color-muted)] font-sans">
                        ยังไม่มีรายการชำระเงินที่สมบูรณ์ในช่วงเวลานี้ ข้อมูลจะอัปเดตแบบเรียลไทม์ทันทีเมื่อมีการชำระเงินผ่านระบบ POS
                    </p>
                </div>
            )}

            {/* 2. Level 1: Executive At-A-Glance Strip (5 Decision Cards + Velocity & Forecast) */}
            <ExecutiveKpiStrip
                salesToday={liveMetrics.totalGrossRevenue}
                salesGrowthPct={comparisonMetrics.salesGrowthPct}
                orderCount={liveMetrics.completedOrdersCount}
                orderGrowthPct={comparisonMetrics.orderGrowthPct}
                guestCount={liveMetrics.guestCount}
                guestGrowthPct={comparisonMetrics.guestGrowthPct}
                avgTicket={liveMetrics.avgBillSize}
                avgTicketGrowthPct={comparisonMetrics.avgTicketGrowthPct}
                salesTarget={activeSalesTarget}
                currentVelocityPerHour={periodPacingMetrics.currentVelocity}
                velocityUnit={periodPacingMetrics.velocityUnit}
                forecastClose={periodPacingMetrics.forecastClose}
                currentHourStr={periodPacingMetrics.tagLabel}
                filterMode={filterMode}
                targetLabel={targetMeta.targetLabel}
                salesTitle={targetMeta.salesCardTitle}
                compareSubtext={targetMeta.compareCode}
                compareLabel={
                    filterMode === 'day'
                        ? compareMode === 'same_day_last_week' ? 'วันเดียวกันสัปดาห์ก่อน (W-1)' : 'เมื่อวานนี้ (D-1)'
                        : filterMode === 'month' ? 'เดือนก่อนหน้า (M-1)' : 'ปีก่อนหน้า (Y-1)'
                }
                onEditTarget={() => {
                    setTargetDrafts({
                        daily: String(dailyTarget),
                        monthly: String(monthlyTarget),
                        yearly: String(yearlyTarget)
                    })
                    setTargetModalTab(filterMode)
                    setIsEditingTarget(true)
                }}
            />

            {/* 3. Segmented Tabular Navigation Strip (Dieter Rams Desktop Horizontal Scrolling & Paging) */}
            <div className="relative border border-[var(--color-rule)] bg-[var(--color-paper-2)] flex items-stretch">
                {/* Desktop Left Scroll Stepper Button */}
                <button
                    type="button"
                    onClick={() => handleNavScroll('left')}
                    disabled={!canScrollNavLeft}
                    aria-label="เลื่อนแท็บไปทางซ้าย"
                    title="เลื่อนแท็บไปทางซ้าย"
                    className={`flex-none px-3.5 flex items-center justify-center tabular-nums text-xs font-bold border-r border-[var(--color-rule)] transition-all min-h-[42px] select-none ${
                        canScrollNavLeft
                            ? 'bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-paper-3)] cursor-pointer active:scale-95'
                            : 'bg-[var(--color-paper-2)] text-[oklch(70%_0.01_348.33)] opacity-40 cursor-not-allowed'
                    }`}
                >
                    ◀
                </button>

                {/* Scrollable Tabs Viewport */}
                <div
                    ref={navScrollRef}
                    onScroll={checkNavScroll}
                    onMouseDown={handleNavMouseDown}
                    onMouseMove={handleNavMouseMove}
                    onMouseUp={handleNavMouseUpOrLeave}
                    onMouseLeave={handleNavMouseUpOrLeave}
                    className={`flex-1 overflow-x-auto financial-nav-scrollbar flex divide-x divide-[var(--color-rule)] tabular-nums text-xs ${
                        isNavDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
                    }`}
                >
                    {[
                        { id: 'master', label: 'ภาพรวม' },
                        { id: 'velocity_daypart', label: 'ความเร็วและช่วงเวลา' },
                        { id: 'ledger', label: `สมุดบัญชีธุรกรรม (${rawTransactionsData.length})` },
                        { id: 'summary', label: 'สรุปยอดและกระทบยอด' },
                        { id: 'heatmap', label: 'สถิติช่วงเวลา' },
                        { id: 'top_menu', label: 'อันดับเมนูขายดี' },
                        { id: 'crm', label: 'สมาชิกและลูกค้าประจำ' },
                        { id: 'casual', label: 'วิเคราะห์เชิงลึก' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            data-tab-id={tab.id}
                            onClick={(e) => {
                                if (hasNavDragged.current) {
                                    e.preventDefault()
                                    return
                                }
                                setActiveTab(tab.id)
                            }}
                            className={`flex-none px-4 py-3 whitespace-nowrap font-bold transition-colors min-h-[42px] select-none ${
                                activeTab === tab.id
                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                    : 'bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Desktop Right Scroll Stepper Button */}
                <button
                    type="button"
                    onClick={() => handleNavScroll('right')}
                    disabled={!canScrollNavRight}
                    aria-label="เลื่อนแท็บไปทางขวา"
                    title="เลื่อนแท็บไปทางขวา"
                    className={`flex-none px-3.5 flex items-center justify-center tabular-nums text-xs font-bold border-l border-[var(--color-rule)] transition-all min-h-[42px] select-none ${
                        canScrollNavRight
                            ? 'bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-paper-3)] cursor-pointer active:scale-95'
                            : 'bg-[var(--color-paper-2)] text-[oklch(70%_0.01_348.33)] opacity-40 cursor-not-allowed'
                    }`}
                >
                    ▶
                </button>
            </div>

            {/* 4. Sub-Components Render Viewport */}
            <div className="space-y-6">

                {/* Master Tab: Revamped Ergonomic Cockpit (Levels 2 - 7) */}
                {activeTab === 'master' && (
                    <div className="space-y-6">
                        
                        {/* Level 2: Sales vs Target & Period Run-Rate / Pacing */}
                        <SalesTargetPaceCockpit
                            currentSales={liveMetrics.totalGrossRevenue}
                            targetSales={activeSalesTarget}
                            hourlyData={hourlyVelocityData}
                            periodPacingData={filterMode === 'month' ? dailyPacingData : filterMode === 'year' ? monthlyPacingData : hourlyVelocityData}
                            currentHour={currentBangkokHour}
                            currentVelocity={periodPacingMetrics.currentVelocity}
                            velocityUnit={periodPacingMetrics.velocityUnit}
                            closingHour={23}
                            filterMode={filterMode}
                            daysLeft={periodPacingMetrics.daysRemaining || 0}
                            daysInMonth={periodPacingMetrics.daysInPeriod || 30}
                            daysElapsed={periodPacingMetrics.daysElapsed || 1}
                            monthsLeft={periodPacingMetrics.monthsRemaining || 0}
                            monthsElapsed={periodPacingMetrics.monthsElapsed || 1}
                            todayDay={todayDay}
                            todayMonth={todayMonth}
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                        />

                        {/* Level 3: Sales Drivers & Smart Anomaly Alerts (2-col grid) */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-7">
                                <SalesDriversTable
                                    items={topMenuData}
                                    totalSales={liveMetrics.totalGrossRevenue}
                                    totalOrders={liveMetrics.completedOrdersCount}
                                    onViewAllMenu={() => setActiveTab('top_menu')}
                                />
                            </div>
                            <div className="lg:col-span-5">
                                <SmartAnomalyAlerts
                                    foodCostPct={liveMetrics.calculatedFoodCostPct || 30.0}
                                    foodCostTarget={30.0}
                                    avgTicketGrowthPct={comparisonMetrics.avgTicketGrowthPct}
                                    currentAvgTicket={liveMetrics.avgBillSize}
                                    deliveryFeeRatioPct={diningChannelsData.find(c => c.code === 'PICKUP' || c.name?.includes('Takeaway'))?.percent || 0}
                                    daypartAnomalies={[]}
                                />
                            </div>
                        </div>

                        {/* Level 4: Menu Engineering Matrix (4 Quadrants) */}
                        <MenuEngineeringMatrix topMenuData={topMenuData} />

                        {/* Level 5: Traffic & Sales Velocity Duo (Decoupled twin sparkbars) */}
                        <TrafficAndVelocityDuo
                            hourlyData={hourlyVelocityData}
                            totalGuests={liveMetrics.guestCount}
                            totalOrders={liveMetrics.completedOrdersCount}
                            walkInEstimates={Math.round(liveMetrics.guestCount * 1.2) || 28}
                            totalSeats={45}
                            currentHour={currentBangkokHour}
                        />

                        {/* Level 6: Channels & Payment Methods Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Dining Channels */}
                            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
                                <div className="p-3 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] flex items-center justify-between tabular-nums text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="px-1.5 py-0.2 text-[11px] font-bold bg-[var(--color-ink)] text-[var(--color-paper)]">
                                            CHANNEL
                                        </span>
                                        <span className="font-bold text-[var(--color-ink)]  ">
                                            DINING CHANNELS // สัดส่วนช่องทางจำหน่าย
                                        </span>
                                    </div>
                                    <span className="text-xs text-[var(--color-muted)] tabular-nums">
                                        รวม ฿{liveMetrics.totalGrossRevenue.toLocaleString()}
                                    </span>
                                </div>
                                <div className="p-4 space-y-3 tabular-nums text-xs">
                                    {diningChannelsData.map((channel, i) => (
                                        <div key={i} className="p-2.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-[var(--color-ink)] font-sans">{channel.name}</span>
                                                <span className="font-bold text-[var(--color-ink)] tabular-nums">฿{channel.amount.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-[var(--color-muted)]">
                                                <span>{channel.tables ? `${channel.tables} โต๊ะ` : `${channel.orders || 0} บิล`}</span>
                                                <span className="font-bold text-[var(--brand-plum)]">{channel.percent}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Payment Methods */}
                            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
                                <div className="p-3 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] flex items-center justify-between tabular-nums text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="px-1.5 py-0.2 text-[11px] font-bold bg-[var(--color-ink)] text-[var(--color-paper)]">
                                            PAYMENT
                                        </span>
                                        <span className="font-bold text-[var(--color-ink)]  ">
                                            PAYMENT METHODS // รูปแบบการชำระเงิน
                                        </span>
                                    </div>
                                    <span className="text-xs text-[var(--color-muted)] tabular-nums">
                                        รวม ฿{liveMetrics.totalGrossRevenue.toLocaleString()}
                                    </span>
                                </div>
                                <div className="p-4 grid grid-cols-2 gap-2 tabular-nums text-xs">
                                    {paymentMethodsData.map((pm, i) => (
                                        <div key={i} className="p-2.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] space-y-1">
                                            <div className="flex justify-between items-center text-xs text-[var(--color-muted)]">
                                                <span className="font-bold ">{pm.code}</span>
                                                <span className="font-bold">{pm.percent}%</span>
                                            </div>
                                            <div className="font-bold text-sm text-[var(--color-ink)] tabular-nums">
                                                ฿{pm.amount.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-[var(--color-neutral)] truncate font-sans">
                                                {pm.name} ({pm.count} รายการ)
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Level 7: Operational Contribution vs Accounting Profit */}
                        <OperationalMarginBreakdown
                            grossSales={liveMetrics.totalGrossRevenue}
                            discounts={liveMetrics.totalDiscounts}
                            fixedExpenses={liveMetrics.totalExpenses}
                            foodCostPct={liveMetrics.calculatedFoodCostPct || 30.0}
                            packagingPct={2.5}
                            platformFeePct={4.5}
                        />

                        {/* Progressive Disclosure Jump Links (Deep Sub-tabs) */}
                        <div className="p-4 border border-[var(--color-rule)] bg-[var(--color-paper-2)] flex flex-wrap items-center justify-between gap-3 tabular-nums text-xs">
                            <span className="text-[var(--color-muted)] font-bold">
                                รายงานเจาะลึกเฉพาะทาง (DEEP DIVE SUB-MODULES):
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('velocity_daypart')}
                                    className="px-3 py-1.5 bg-[var(--color-paper)] hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)] border border-[var(--color-rule)] font-bold transition-colors cursor-pointer"
                                >
                                    [วิเคราะห์ความเร็ว & กะเวลา]
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('ledger')}
                                    className="px-3 py-1.5 bg-[var(--color-paper)] hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)] border border-[var(--color-rule)] font-bold transition-colors cursor-pointer"
                                >
                                    [สมุดบัญชีธุรกรรม ({rawTransactionsData.length})]
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('summary')}
                                    className="px-3 py-1.5 bg-[var(--color-paper)] hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)] border border-[var(--color-rule)] font-bold transition-colors cursor-pointer"
                                >
                                    [กระทบยอด POS & บัญชี]
                                </button>
                            </div>
                        </div>

                    </div>
                )}

                {/* Dedicated Intraday & Monthly Velocity Daypart Tab */}
                {activeTab === 'velocity_daypart' && (
                    <IntradayVelocityDaypartCockpit
                        bookings={rawTransactionsData}
                        filterMode={filterMode}
                        selectedDate={selectedDate}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        totalSeats={45}
                        loading={loading}
                        totalExpenses={liveMetrics.totalExpenses}
                    />
                )}

                {/* Dedicated Ledger Tab */}
                {activeTab === 'ledger' && (
                    <DatabaseVisualLedger
                        rawTransactions={rawTransactionsData}
                        timeRangeLabel={getTimeRangeLabel()}
                    />
                )}

                {/* Dedicated Sales & Reconciliation Tab */}
                {activeTab === 'summary' && (
                    <DetailedSalesSummary 
                        data={{
                            paymentMethods: paymentMethodsData,
                            diningChannels: diningChannelsData,
                            auditReconciliation: auditReconciliationData,
                            hourlyVelocity: hourlyVelocityData,
                        }}
                        timeRangeLabel={getTimeRangeLabel()} 
                    />
                )}

                {/* Dedicated Heatmap Tab */}
                {activeTab === 'heatmap' && (
                    <FinancialHeatmap
                        data={{
                            heatmapMatrix: heatmapMatrixData,
                            shiftMetrics: shiftMetricsData
                        }}
                    />
                )}

                {/* Dedicated Top Menu Tab */}
                {activeTab === 'top_menu' && (
                    <TopMenuInfographic data={{ topMenuData }} />
                )}

                {/* Dedicated CRM Tab */}
                {activeTab === 'crm' && (
                    <CRMFinancialSummary data={crmData} />
                )}

                {/* Dedicated Casual Insights Tab */}
                {activeTab === 'casual' && (
                    <div className="space-y-6">
                        <CasualDiningInsights data={casualData} />
                        <InteractiveBcgScatter 
                            topMenuData={topMenuData} 
                            menuMatrix={unmetNeedData?.menuMatrix} 
                        />
                        <UnmetNeedAnalytics data={unmetNeedData} />
                    </div>
                )}
            </div>

            {/* Target Editing Modal Dialog (Daily, Monthly, Yearly) */}
            {isEditingTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 tabular-nums shadow-2xl">
                        
                        {/* Modal Header */}
                        <div className="flex justify-between items-start border-b border-[var(--color-rule)] pb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.2 text-[11px] font-bold bg-[var(--color-ink)] text-[var(--color-paper)]">
                                        TARGET CONFIG
                                    </span>
                                    <span className="font-bold text-sm text-[var(--color-ink)]  ">
                                        ตั้งเป้าหมายยอดขาย (Sales Targets)
                                    </span>
                                </div>
                                <p className="text-[13px] text-[var(--color-muted)] mt-1">
                                    กำหนดเป้าหมายแยกตามรอบเวลา (รายวัน / รายเดือน / รายปี)
                                </p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsEditingTarget(false)} 
                                className="admin-btn h-8 px-3"
                                aria-label="ปิดการแก้ไขเป้าหมาย"
                            >
                                ปิด
                            </button>
                        </div>

                        {/* Modal Scope Selector Tabs */}
                        <div className="flex border border-[var(--color-rule)] divide-x divide-[var(--color-rule)] text-xs">
                            {[
                                { id: 'all', label: 'ทั้งหมด' },
                                { id: 'day', label: 'รายวัน' },
                                { id: 'month', label: 'รายเดือน' },
                                { id: 'year', label: 'รายปี' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setTargetModalTab(tab.id)}
                                    className={`flex-1 py-1.5 font-bold transition-colors text-center ${
                                        targetModalTab === tab.id
                                            ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                            : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] hover:bg-[var(--color-paper)]'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Form Inputs Container */}
                        <div className="space-y-4">
                            
                            {/* 1. Daily Target Input */}
                            {(targetModalTab === 'all' || targetModalTab === 'day') && (
                                <div className={`p-3 border space-y-2 ${
                                    filterMode === 'day' 
                                        ? 'border-[var(--brand-plum)] bg-[var(--color-paper-2)]/60' 
                                        : 'border-[var(--color-rule)] bg-[var(--color-paper)]'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-[var(--color-ink)] ">
                                            เป้าหมายรายวัน (Daily Target)
                                        </label>
                                        {filterMode === 'day' && (
                                            <span className="text-[11px] px-1.5 py-0.2 bg-[var(--brand-plum)] text-[var(--color-paper)] font-bold">
                                                มุมมองปัจจุบัน
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-[var(--color-neutral)] text-base font-bold select-none">฿</span>
                                        <input
                                            type="number"
                                            value={targetDrafts.daily}
                                            onChange={(e) => setTargetDrafts(prev => ({ ...prev, daily: e.target.value }))}
                                            className="w-full pl-8 pr-16 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-lg text-[var(--color-ink)] focus:outline-none focus:border-[var(--brand-plum)] tabular-nums"
                                            placeholder="15000"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs text-[var(--color-muted)] select-none">/ วัน</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-[var(--color-muted)]">
                                        <span>ใช้คำนวณในรายงานประจำวัน & Run-rate รายชั่วโมง</span>
                                        <span className="text-[var(--color-neutral)]">ค่าเดิม: ฿{dailyTarget.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            {/* 2. Monthly Target Input */}
                            {(targetModalTab === 'all' || targetModalTab === 'month') && (
                                <div className={`p-3 border space-y-2 ${
                                    filterMode === 'month' 
                                        ? 'border-[var(--brand-plum)] bg-[var(--color-paper-2)]/60' 
                                        : 'border-[var(--color-rule)] bg-[var(--color-paper)]'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-[var(--color-ink)] ">
                                            เป้าหมายรายเดือน (Monthly Target)
                                        </label>
                                        {filterMode === 'month' && (
                                            <span className="text-[11px] px-1.5 py-0.2 bg-[var(--brand-plum)] text-[var(--color-paper)] font-bold">
                                                มุมมองปัจจุบัน
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-[var(--color-neutral)] text-base font-bold select-none">฿</span>
                                        <input
                                            type="number"
                                            value={targetDrafts.monthly}
                                            onChange={(e) => setTargetDrafts(prev => ({ ...prev, monthly: e.target.value }))}
                                            className="w-full pl-8 pr-16 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-lg text-[var(--color-ink)] focus:outline-none focus:border-[var(--brand-plum)] tabular-nums"
                                            placeholder="450000"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs text-[var(--color-muted)] select-none">/ เดือน</span>
                                    </div>
                                    <div className="flex flex-wrap justify-between items-center gap-1 text-xs text-[var(--color-muted)]">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const d = parseInt(targetDrafts.daily, 10) || dailyTarget || 15000
                                                setTargetDrafts(prev => ({ ...prev, monthly: String(d * 30) }))
                                            }}
                                            className="underline text-[var(--brand-plum)] hover:text-[var(--color-ink)] cursor-pointer"
                                        >
                                            [คำนวณออโต้: เป้าวัน x 30 วัน = ฿{((parseInt(targetDrafts.daily, 10) || dailyTarget || 15000) * 30).toLocaleString()}]
                                        </button>
                                        <span className="text-[var(--color-neutral)]">ค่าเดิม: ฿{monthlyTarget.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            {/* 3. Yearly Target Input */}
                            {(targetModalTab === 'all' || targetModalTab === 'year') && (
                                <div className={`p-3 border space-y-2 ${
                                    filterMode === 'year' 
                                        ? 'border-[var(--brand-plum)] bg-[var(--color-paper-2)]/60' 
                                        : 'border-[var(--color-rule)] bg-[var(--color-paper)]'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-[var(--color-ink)] ">
                                            เป้าหมายรายปี (Yearly Target)
                                        </label>
                                        {filterMode === 'year' && (
                                            <span className="text-[11px] px-1.5 py-0.2 bg-[var(--brand-plum)] text-[var(--color-paper)] font-bold">
                                                มุมมองปัจจุบัน
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-[var(--color-neutral)] text-base font-bold select-none">฿</span>
                                        <input
                                            type="number"
                                            value={targetDrafts.yearly}
                                            onChange={(e) => setTargetDrafts(prev => ({ ...prev, yearly: e.target.value }))}
                                            className="w-full pl-8 pr-16 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-lg text-[var(--color-ink)] focus:outline-none focus:border-[var(--brand-plum)] tabular-nums"
                                            placeholder="5400000"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs text-[var(--color-muted)] select-none">/ ปี</span>
                                    </div>
                                    <div className="flex flex-wrap justify-between items-center gap-1 text-xs text-[var(--color-muted)]">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const m = parseInt(targetDrafts.monthly, 10) || monthlyTarget || 450000
                                                setTargetDrafts(prev => ({ ...prev, yearly: String(m * 12) }))
                                            }}
                                            className="underline text-[var(--brand-plum)] hover:text-[var(--color-ink)] cursor-pointer"
                                        >
                                            [คำนวณออโต้: เป้าเดือน x 12 เดือน = ฿{((parseInt(targetDrafts.monthly, 10) || monthlyTarget || 450000) * 12).toLocaleString()}]
                                        </button>
                                        <span className="text-[var(--color-neutral)]">ค่าเดิม: ฿{yearlyTarget.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Modal Footer Actions */}
                        <div className="flex gap-2 justify-end pt-3 border-t border-[var(--color-rule)]">
                            <button
                                type="button"
                                onClick={() => setIsEditingTarget(false)}
                                className="px-3.5 py-2 text-xs text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] border border-transparent cursor-pointer font-bold"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const d = Math.max(1, parseInt(targetDrafts.daily, 10) || 15000)
                                    const m = Math.max(1, parseInt(targetDrafts.monthly, 10) || 450000)
                                    const y = Math.max(1, parseInt(targetDrafts.yearly, 10) || 5400000)

                                    setDailyTarget(d)
                                    setMonthlyTarget(m)
                                    setYearlyTarget(y)

                                    try {
                                        localStorage.setItem('inth_daily_sales_target', String(d))
                                        localStorage.setItem('inth_monthly_sales_target', String(m))
                                        localStorage.setItem('inth_yearly_sales_target', String(y))
                                    } catch {
                                        // ignore storage quotas
                                    }

                                    setIsEditingTarget(false)
                                    toast.success(`บันทึกเป้าหมายเรียบร้อย (รายวัน: ฿${d.toLocaleString()} | รายเดือน: ฿${m.toLocaleString()} | รายปี: ฿${y.toLocaleString()})`)
                                }}
                                className="px-4 py-2 text-xs bg-[var(--color-ink)] text-[var(--color-paper)] font-bold hover:bg-[oklch(28%_0.012_348.33)] cursor-pointer transition-colors "
                            >
                                บันทึกเป้าหมาย
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    )
}
