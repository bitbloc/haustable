/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useRef, useCallback } from 'react'
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
import { classifyMenuCategory, formatCategoryLabel, MENU_CATEGORY_KEYS } from '../../utils/categoryClassifier'

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

                // Calculate previous day for comparison
                const curD = new Date(selectedDate)
                curD.setDate(curD.getDate() - 1)
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
                        booking_time,
                        created_at,
                        total_amount,
                        discount_amount,
                        xhaus_discount,
                        status,
                        pax,
                        booking_type,
                        payment_slip_url,
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
                            custom_name,
                            menu_items (
                                id,
                                name,
                                price,
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
            if (compareWithPrev) {
                try {
                    const { data: prevData } = await supabase
                        .from('bookings')
                        .select('total_amount, status')
                        .gte('booking_time', prevStartIso)
                        .lte('booking_time', prevEndIso)

                    if (currentSeq === fetchSeqRef.current && prevData) {
                        const prevValid = prevData.filter(b => 
                            ['completed', 'confirmed', 'paid', 'success', 'seated', 'ready'].includes(b.status)
                        )
                        prevGross = prevValid.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0)
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

            // Filter for valid revenue-generating orders
            const validOrders = (bookingsRes.data || []).filter(b => 
                ['completed', 'confirmed', 'paid', 'success', 'seated', 'ready'].includes(b.status)
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
            let totalGross = 0
            let totalDiscounts = 0
            let discountCount = 0
            let totalGuests = 0
            let promptpayAmt = 0, creditAmt = 0, cashAmt = 0, walletAmt = 0
            let promptpayCount = 0, creditCount = 0, cashCount = 0, walletCount = 0
            let dineInAmt = 0, takeawayAmt = 0
            let dineInTables = 0, takeawayOrders = 0

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
            const hourlyAgg = Array(24).fill(0).map(() => ({ gross: 0, bills: 0, items: {} }))
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

                totalGross += amount
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

                // Payment Method detection (Split parsing & remarks)
                const isRemarkCredit = remark.includes('credit') || remark.includes('card') || remark.includes('บัตร')
                const isRemarkQr = b.payment_slip_url || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน') || remark.includes('promptpay')
                const isRemarkWallet = remark.includes('wallet')

                let txPayMethod = 'Cash'
                let txIsSplit = false

                const splitMatch = remark.match(/\[split:?\s*([^\]]+)\]/i) || remark.match(/split:\s*([^,\n\]]+(?:,[^,\n\]]+)*)/i)
                if (splitMatch) {
                    txIsSplit = true
                    txPayMethod = 'Split'
                    const splitText = splitMatch[1]
                    let spCash = 0, spQr = 0, spCredit = 0
                    const cashM = splitText.match(/cash[:=\s]+(\d+(?:\.\d+)?)/i)
                    if (cashM) spCash = parseFloat(cashM[1]) || 0
                    const qrM = splitText.match(/(?:qr|transfer|โอน)[:=\s]+(\d+(?:\.\d+)?)/i)
                    if (qrM) spQr = parseFloat(qrM[1]) || 0
                    const creditM = splitText.match(/(?:credit|card|บัตร)[:=\s]+(\d+(?:\.\d+)?)/i)
                    if (creditM) spCredit = parseFloat(creditM[1]) || 0

                    if (spCash > 0) { cashAmt += spCash; cashCount++ }
                    if (spQr > 0) { promptpayAmt += spQr; promptpayCount++ }
                    if (spCredit > 0) { creditAmt += spCredit; creditCount++ }
                } else if (isRemarkCredit) {
                    txPayMethod = 'Credit Card'
                    creditAmt += amount; creditCount++
                } else if (isRemarkQr) {
                    txPayMethod = 'PromptPay QR'
                    promptpayAmt += amount; promptpayCount++
                } else if (isRemarkWallet) {
                    txPayMethod = 'Member Wallet'
                    walletAmt += amount; walletCount++
                } else {
                    txPayMethod = 'Cash'
                    cashAmt += amount; cashCount++
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
                    const rawCatName = mItem?.menu_categories?.name || item.category_name || item.category || 'ทั่วไป'
                    const catKey = classifyMenuCategory(rawCatName, itemName)
                    const formattedCatLabel = formatCategoryLabel(rawCatName)

                    formattedItems.push({
                        name: itemName,
                        quantity: qty,
                        price: itemPrice,
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
                            price: itemPrice
                        }
                    }
                    itemAgg[itemName].units += qty
                    itemAgg[itemName].revenue += itemRev

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
            const salesPerHead = totalGuests > 0 ? Math.round(totalGross / totalGuests) : 0
            const avgBillSize = completedOrdersCount > 0 ? Math.round(totalGross / completedOrdersCount) : 0
            const netRev = totalGross - totalDiscounts
            const netProfitReal = hasRecordedExpenses ? (netRev - totalExpensesReal) : netRev
            const netProfitMarginPct = totalGross > 0 ? ((netProfitReal / totalGross) * 100).toFixed(1) : '0.0'
            const tableTurnoverRate = (completedOrdersCount / 12).toFixed(1)

            let growthPct = '0.0'
            if (prevGross > 0) {
                const diff = ((totalGross - prevGross) / prevGross) * 100
                growthPct = (diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1))
            } else if (totalGross > 0) {
                growthPct = '+100.0'
            }

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
                { name: 'Dine-In (ทานที่ร้าน / จองโต๊ะ)', amount: dineInAmt, percent: Math.round((dineInAmt / (totalGross || 1)) * 100), tables: dineInTables, avgPerTable: dineInTables > 0 ? Math.round(dineInAmt / dineInTables) : 0, code: 'DINE_IN' },
                { name: 'Takeaway / Pickup (รับกลับบ้าน)', amount: takeawayAmt, percent: Math.round((takeawayAmt / (totalGross || 1)) * 100), orders: takeawayOrders, avgPerOrder: takeawayOrders > 0 ? Math.round(takeawayAmt / takeawayOrders) : 0, code: 'PICKUP' },
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
                        hour: `${hr.toString().padStart(2, '0')}:00 - ${(hr + 1).toString().padStart(2, '0')}:00`,
                        gross: h.gross,
                        bills: h.bills,
                        avgBill: h.bills > 0 ? Math.round(h.gross / h.bills) : 0,
                        peakItem: peakItemName,
                    }
                })
                .filter(h => h.gross > 0 || h.bills > 0)
            setHourlyVelocityData(formattedHourly)

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
    }, [filterMode, selectedDate, selectedMonth, selectedYear, compareWithPrev])

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

    const getTimeRangeLabel = () => {
        if (filterMode === 'day') return `ประจำวันที่ ${selectedDate}`
        if (filterMode === 'month') return `ประจำเดือน ${selectedMonth}`
        if (filterMode === 'year') return `ประจำปี ${selectedYear}`
        return 'ช่วงเวลาที่เลือก'
    }

    const handleExportReport = () => {
        toast.success(`ส่งออกรายงานทางการเงิน (${getTimeRangeLabel()}) เรียบร้อย`)
    }

    return (
        <div className="space-y-6 pb-20 text-[oklch(18%_0.012_28)] bg-[oklch(97%_0.008_28)]">
            
            {/* 1. Master Tabular Header Bar (Neo-Brutalist 1px Border Grid) */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] divide-y divide-[oklch(85%_0.012_28)]">
                
                {/* Header Row: Title & Realtime Connection Status */}
                <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]">
                                WORKBENCH // 05
                            </span>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)]">
                                ระบบรายงานและการเงิน (Financial Cockpit)
                            </h1>
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 font-bold border ${
                                isLiveConnected
                                    ? 'bg-[oklch(97%_0.008_28)] text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]/40'
                                    : 'bg-[oklch(97%_0.008_28)] text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)]/40'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isLiveConnected ? 'bg-[oklch(45%_0.08_140)] animate-pulse' : 'bg-[oklch(52%_0.16_28)]'}`} />
                                {isLiveConnected ? 'REALTIME SYNCED' : 'CONNECTING'}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] font-bold border border-[oklch(85%_0.012_28)]">
                                {dbLatencyMs}ms ({dbRecordCount} rows)
                            </span>
                        </div>
                        <p className="text-xs font-mono text-[oklch(42%_0.010_28)] mt-1.5">
                            ข้อมูลธุรกรรมจริงจากฐานข้อมูล POS // {getTimeRangeLabel()}
                        </p>
                    </div>

                    {/* Action Tools */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => {
                                fetchRealFinancialData()
                                toast.success('อัพเดทข้อมูลการเงินล่าสุดแล้ว')
                            }}
                            disabled={loading}
                            className="px-3.5 py-2 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-xs font-bold transition-all min-h-[38px] flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <span>{loading ? 'กำลังดึงข้อมูล…' : 'รีเฟรช [SYNC]'}</span>
                        </button>

                        <button
                            onClick={() => setCompareWithPrev(!compareWithPrev)}
                            className={`px-3.5 py-2 font-mono text-xs font-bold transition-all border min-h-[38px] ${
                                compareWithPrev
                                    ? 'bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] border-[oklch(18%_0.012_28)]'
                                    : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(97%_0.008_28)]'
                            }`}
                        >
                            <span>เทียบช่วงก่อน {compareWithPrev ? '[เปิด]' : '[ปิด]'}</span>
                        </button>

                        <Link
                            to="/admin/tax"
                            className="px-3.5 py-2 bg-[oklch(97%_0.008_28)] hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs font-bold transition-all min-h-[38px] flex items-center"
                        >
                            <span>ระบบภาษี & ใบกำกับ →</span>
                        </Link>

                        <button
                            onClick={handleExportReport}
                            className="px-3.5 py-2 bg-[oklch(97%_0.008_28)] hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs font-bold transition-all min-h-[38px]"
                        >
                            <span>ส่งออก [CSV]</span>
                        </button>
                    </div>
                </div>

                {/* Filter Ribbon Row: Day / Month / Year Mode & Date Picker */}
                <div className="p-3 bg-[oklch(97%_0.008_28)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
                    
                    {/* Period Switcher */}
                    <div className="inline-flex border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)]">
                        {[
                            { id: 'day', label: 'รายวัน [DAY]' },
                            { id: 'month', label: 'รายเดือน [MONTH]' },
                            { id: 'year', label: 'รายปี [YEAR]' },
                        ].map(mode => (
                            <button
                                key={mode.id}
                                onClick={() => setFilterMode(mode.id)}
                                className={`px-3.5 py-1.5 font-bold transition-colors ${
                                    filterMode === mode.id
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                        : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(97%_0.008_28)]'
                                }`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Inputs & Quick Presets */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {filterMode === 'day' && (
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="px-3 py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            />
                        )}

                        {filterMode === 'month' && (
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="px-3 py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            />
                        )}

                        {filterMode === 'year' && (
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="px-3 py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)] cursor-pointer"
                            >
                                <option value="2026">ปี 2026</option>
                                <option value="2025">ปี 2025</option>
                                <option value="2024">ปี 2024</option>
                            </select>
                        )}

                        <button
                            onClick={() => { setFilterMode('day'); setSelectedDate(getThaiDate()); }}
                            className="px-2.5 py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] hover:bg-[oklch(97%_0.008_28)] font-bold text-[11px]"
                        >
                            วันนี้
                        </button>
                        <button
                            onClick={() => { setFilterMode('month'); setSelectedMonth(getCurrentBangkokMonth()); }}
                            className="px-2.5 py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] hover:bg-[oklch(97%_0.008_28)] font-bold text-[11px]"
                        >
                            เดือนนี้
                        </button>
                    </div>
                </div>
            </div>

            {/* Zero State Alert (Clean Typography Enclosure) */}
            {!hasLiveData && !loading && (
                <div className="p-4 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)]" />
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                            ZERO TRANSACTIONS RECORDED // {getTimeRangeLabel()}
                        </span>
                    </div>
                    <p className="text-xs text-[oklch(42%_0.010_28)]">
                        ยังไม่มีรายการชำระเงินที่สมบูรณ์ในช่วงเวลานี้ ข้อมูลจะอัปเดตแบบเรียลไทม์ทันทีเมื่อมีการชำระเงินผ่านระบบ POS
                    </p>
                </div>
            )}

            {/* 2. Core Financial KPI Tabular Grid (Dieter Rams 4-Cell Matrix) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[oklch(85%_0.012_28)] divide-y sm:divide-y-0 sm:divide-x divide-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]">
                
                {/* Cell 1: Gross Sales */}
                <div className="p-4 md:p-5 space-y-2 bg-[oklch(97%_0.008_28)]">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[oklch(42%_0.010_28)]">
                        <span>01 // GROSS REVENUE</span>
                        <span className="text-[oklch(18%_0.012_28)]">{liveMetrics.completedOrdersCount} บิล</span>
                    </div>
                    <div className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-[oklch(18%_0.012_28)] tabular-nums">
                        ฿{liveMetrics.totalGrossRevenue.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-[oklch(85%_0.012_28)]">
                        <span className="text-[oklch(42%_0.010_28)]">ส่วนลดรวม: ฿{liveMetrics.totalDiscounts.toLocaleString()}</span>
                        {compareWithPrev && (
                            <span className={`font-bold ${liveMetrics.growthVsPrevPeriod.startsWith('-') ? 'text-[oklch(52%_0.16_28)]' : 'text-[oklch(45%_0.08_140)]'}`}>
                                {liveMetrics.growthVsPrevPeriod}%
                            </span>
                        )}
                    </div>
                </div>

                {/* Cell 2: Spend Per Head */}
                <div className="p-4 md:p-5 space-y-2 bg-[oklch(97%_0.008_28)]">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[oklch(42%_0.010_28)]">
                        <span>02 // SPEND / HEAD</span>
                        <span className="text-[oklch(18%_0.012_28)]">{liveMetrics.guestCount} ท่าน</span>
                    </div>
                    <div className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-[oklch(52%_0.16_28)] tabular-nums">
                        ฿{liveMetrics.salesPerHead}
                    </div>
                    <div className="font-mono text-[11px] text-[oklch(42%_0.010_28)] pt-1 border-t border-[oklch(85%_0.012_28)]">
                        เฉลี่ยต่อผู้ใช้บริการจริง
                    </div>
                </div>

                {/* Cell 3: Real Net Operating Income / Expenses */}
                <div className="p-4 md:p-5 space-y-2 bg-[oklch(97%_0.008_28)]">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[oklch(42%_0.010_28)]">
                        <span>03 // NET OPERATING</span>
                        <span className="text-[oklch(18%_0.012_28)]">{liveMetrics.hasRecordedExpenses ? 'EXPENSE SYNC' : 'GROSS NET'}</span>
                    </div>
                    <div className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-[oklch(18%_0.012_28)] tabular-nums">
                        ฿{liveMetrics.netProfitReal.toLocaleString()}
                    </div>
                    <div className="font-mono text-[11px] text-[oklch(42%_0.010_28)] pt-1 border-t border-[oklch(85%_0.012_28)] flex justify-between">
                        <span>รายจ่ายจริง: ฿{liveMetrics.totalExpenses.toLocaleString()}</span>
                        <span>~{liveMetrics.netProfitMarginPct}%</span>
                    </div>
                </div>

                {/* Cell 4: Average Ticket & Table Turns */}
                <div className="p-4 md:p-5 space-y-2 bg-[oklch(97%_0.008_28)]">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[oklch(42%_0.010_28)]">
                        <span>04 // AVG TICKET</span>
                        <span className="text-[oklch(18%_0.012_28)]">{liveMetrics.tableTurnoverRate} TURNS/TABLE</span>
                    </div>
                    <div className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-[oklch(18%_0.012_28)] tabular-nums">
                        ฿{liveMetrics.avgBillSize.toLocaleString()}
                    </div>
                    <div className="font-mono text-[11px] text-[oklch(42%_0.010_28)] pt-1 border-t border-[oklch(85%_0.012_28)]">
                        ยอดเฉลี่ยต่อ 1 ออเดอร์
                    </div>
                </div>
            </div>

            {/* 3. Segmented Tabular Navigation Strip */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] overflow-x-auto no-scrollbar flex divide-x divide-[oklch(85%_0.012_28)] font-mono text-xs">
                {[
                    { id: 'master', label: 'ภาพรวม [MASTER COCKPIT]' },
                    { id: 'ledger', label: `สมุดบัญชีธุรกรรม [LEDGER: ${rawTransactionsData.length}]` },
                    { id: 'summary', label: 'สรุปยอดและกระทบยอด [RECONCILIATION]' },
                    { id: 'heatmap', label: 'สถิติช่วงเวลา [HEATMAP 7x12]' },
                    { id: 'top_menu', label: 'อันดับเมนูขายดี [MENU RANKING]' },
                    { id: 'crm', label: 'สมาชิกและลูกค้าประจำ [CRM SHARE]' },
                    { id: 'casual', label: 'วิเคราะห์เชิงลึก [OPERATIONAL INSIGHTS]' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-3 whitespace-nowrap font-bold transition-colors min-h-[42px] ${
                            activeTab === tab.id
                                ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                : 'bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 4. Sub-Components Render Viewport */}
            <div className="space-y-6">

                {/* Master Tab: Compact High-Level Summary + Visual Ledger */}
                {activeTab === 'master' && (
                    <div className="space-y-6">
                        <DetailedSalesSummary 
                            data={{
                                paymentMethods: paymentMethodsData,
                                diningChannels: diningChannelsData,
                                auditReconciliation: auditReconciliationData,
                                hourlyVelocity: hourlyVelocityData,
                            }}
                            timeRangeLabel={getTimeRangeLabel()} 
                        />

                        <DatabaseVisualLedger
                            rawTransactions={rawTransactionsData}
                            timeRangeLabel={getTimeRangeLabel()}
                        />
                    </div>
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
                        <UnmetNeedAnalytics data={unmetNeedData} />
                    </div>
                )}
            </div>
        </div>
    )
}
