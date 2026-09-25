/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · utility: Order Round & Batch Classifier */
import { formatThaiTimeOnly } from './timeUtils'

/**
 * Group order items into chronological rounds based on creation time.
 * If created_at is separated by thresholdMinutes (default 3 minutes),
 * items are clustered into separate rounds (รอบ 1, รอบ 2 สั่งเพิ่ม, etc.).
 *
 * @param {Array} orderItems - Array of order item objects (should contain created_at, quantity, price_at_time/price)
 * @param {string|Date} initialTime - Table start/booking time (fallback if item created_at is missing)
 * @param {number} thresholdMinutes - Minutes threshold between batches (default: 3)
 */
export function groupOrderItemsIntoRounds(orderItems = [], initialTime = null, thresholdMinutes = 3) {
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
        return {
            rounds: [],
            totalRounds: 0,
            hasAdditionalOrders: false,
            additionalRoundsCount: 0,
            totalItemsCount: 0,
            totalBillAmount: 0,
            latestRound: null,
            latestOrderTime: null,
            latestOrderTimeStr: '',
            latestElapsedMinutes: 0
        }
    }

    const baseTimeMs = initialTime ? new Date(initialTime).getTime() : 0

    // Clone and sort items chronologically
    const sorted = [...orderItems].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : baseTimeMs
        const timeB = b.created_at ? new Date(b.created_at).getTime() : baseTimeMs
        return timeA - timeB
    })

    const thresholdMs = thresholdMinutes * 60 * 1000
    const rounds = []
    let currentRoundItems = []
    let currentRoundTimeMs = null
    let currentRoundTimeIso = null

    sorted.forEach((item) => {
        const itemTimeMs = item.created_at ? new Date(item.created_at).getTime() : (baseTimeMs || Date.now())
        const itemTimeIso = item.created_at || (initialTime || new Date(itemTimeMs).toISOString())

        if (currentRoundItems.length === 0) {
            currentRoundItems.push(item)
            currentRoundTimeMs = itemTimeMs
            currentRoundTimeIso = itemTimeIso
        } else {
            // Check if item was added significantly later than the current round's start time
            if (itemTimeMs - currentRoundTimeMs > thresholdMs) {
                // Finalize previous round
                rounds.push(createRoundObject(rounds.length + 1, currentRoundItems, currentRoundTimeIso, currentRoundTimeMs, baseTimeMs))
                // Start new round
                currentRoundItems = [item]
                currentRoundTimeMs = itemTimeMs
                currentRoundTimeIso = itemTimeIso
            } else {
                currentRoundItems.push(item)
            }
        }
    })

    if (currentRoundItems.length > 0) {
        rounds.push(createRoundObject(rounds.length + 1, currentRoundItems, currentRoundTimeIso, currentRoundTimeMs, baseTimeMs))
    }

    const totalRounds = rounds.length
    const hasAdditionalOrders = totalRounds > 1
    const additionalRoundsCount = Math.max(0, totalRounds - 1)
    const latestRound = rounds[rounds.length - 1] || null
    const latestOrderTimeStr = latestRound ? latestRound.timeStr : ''
    const latestElapsedMinutes = latestRound ? latestRound.elapsedFromStartMinutes : 0
    const totalItemsCount = orderItems.length
    const totalBillAmount = rounds.reduce((sum, r) => sum + r.totalAmount, 0)

    return {
        rounds,
        totalRounds,
        hasAdditionalOrders,
        additionalRoundsCount,
        totalItemsCount,
        totalBillAmount,
        latestRound,
        latestOrderTime: latestRound?.timeIso || null,
        latestOrderTimeStr,
        latestElapsedMinutes
    }
}

function createRoundObject(roundNumber, items, timeIso, timeMs, baseTimeMs) {
    const isInitial = roundNumber === 1
    const isAdditional = roundNumber > 1
    const timeStr = formatThaiTimeOnly(timeIso)
    
    // Elapsed minutes from table opening
    let elapsedFromStartMinutes = 0
    if (baseTimeMs && timeMs && timeMs > baseTimeMs) {
        elapsedFromStartMinutes = Math.floor((timeMs - baseTimeMs) / 60000)
    }

    // Is recent (placed within the last 15 minutes)
    const nowMs = Date.now()
    const isRecent = Boolean(timeMs && (nowMs - timeMs) >= 0 && (nowMs - timeMs) <= 15 * 60 * 1000)

    const totalAmount = items.reduce((sum, it) => {
        const price = Number(it.price_at_time || it.price || it.menu_items?.price || 0)
        const qty = Number(it.quantity || 1)
        return sum + (price * qty)
    }, 0)

    const totalQuantity = items.reduce((sum, it) => sum + Number(it.quantity || 1), 0)

    return {
        roundNumber,
        isInitial,
        isAdditional,
        timeIso,
        timeMs,
        timeStr,
        items,
        totalAmount,
        totalQuantity,
        elapsedFromStartMinutes,
        isRecent
    }
}
