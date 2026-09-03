/**
 * Split Payment Helper Utility (HAUS TABLE OS)
 * Handles multi-round split payments, percentage calculations,
 * and structured split history metadata serialization.
 */

/**
 * Parse split rounds from booking.staff_remark or metadata
 * @param {Object} booking - Booking object or { staff_remark: string }
 * @returns {Array<{ round: number, amount: number, method: string, mode: string, percent?: number, payer?: string, time?: string, splitBookingId?: string }>}
 */
export function getBookingSplitRounds(booking) {
    if (!booking || typeof booking !== 'object') return [];
    const remark = typeof booking.staff_remark === 'string' ? booking.staff_remark : '';
    if (!remark) return [];

    // 1. Check for structured JSON [SPLIT_ROUNDS: [...]]
    const roundsMatch = remark.match(/\[SPLIT_ROUNDS:\s*(\[.*?\])\s*\]/is);
    if (roundsMatch) {
        try {
            const parsed = JSON.parse(roundsMatch[1]);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map((r, idx) => ({
                    round: r.round || idx + 1,
                    amount: Math.max(0, parseFloat(r.amount) || 0),
                    method: (r.method || 'qr').toLowerCase(),
                    mode: r.mode || 'CUSTOM',
                    percent: r.percent !== undefined && r.percent !== null ? parseFloat(r.percent) : null,
                    payer: r.payer || null,
                    time: r.time || null,
                    splitBookingId: r.splitBookingId || null
                }));
            }
        } catch (e) {
            console.warn('[getBookingSplitRounds] JSON parse error:', e);
        }
    }

    // 2. Fallback: Parse legacy [SPLIT: CASH=100, QR=200, CREDIT=50]
    const splitMatch = remark.match(/\[split:?\s*([^\]]+)\]/i);
    if (splitMatch) {
        const text = splitMatch[1];
        const rounds = [];
        let rIndex = 1;

        const cashM = text.match(/cash[:=\s]+(\d+(?:\.\d+)?)/i);
        if (cashM && parseFloat(cashM[1]) > 0) {
            rounds.push({
                round: rIndex++,
                amount: parseFloat(cashM[1]),
                method: 'cash',
                mode: 'CUSTOM',
                time: booking.booking_time || null
            });
        }
        const qrM = text.match(/(?:qr|transfer|โอน)[:=\s]+(\d+(?:\.\d+)?)/i);
        if (qrM && parseFloat(qrM[1]) > 0) {
            rounds.push({
                round: rIndex++,
                amount: parseFloat(qrM[1]),
                method: 'qr',
                mode: 'CUSTOM',
                time: booking.booking_time || null
            });
        }
        const creditM = text.match(/(?:credit|card|บัตร)[:=\s]+(\d+(?:\.\d+)?)/i);
        if (creditM && parseFloat(creditM[1]) > 0) {
            rounds.push({
                round: rIndex++,
                amount: parseFloat(creditM[1]),
                method: 'credit',
                mode: 'CUSTOM',
                time: booking.booking_time || null
            });
        }
        if (rounds.length > 0) return rounds;
    }

    // 3. Fallback: Check for "Partial Split Paid ฿XXX"
    const partialMatch = remark.match(/partial split paid ฿?(\d+(?:\.\d+)?)/i);
    if (partialMatch) {
        return [{
            round: 1,
            amount: parseFloat(partialMatch[1]),
            method: 'qr',
            mode: 'CUSTOM',
            time: booking.booking_time || null
        }];
    }

    return [];
}

/**
 * Calculate total already paid from previous split rounds
 * @param {Object} booking 
 * @returns {number} Total paid amount in Baht
 */
export function getSplitTotalPaid(booking) {
    const rounds = getBookingSplitRounds(booking);
    return rounds.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
}

/**
 * Calculate comprehensive split balances for an active booking
 * @param {Object} booking - Active table booking
 * @param {Array} orderItems - Current order items array
 * @param {boolean} includeTax - Whether 7% VAT is included
 * @returns {Object} Calculated split balance metrics
 */
export function calculateSplitBalance(booking, orderItems = [], includeTax = true) {
    const rounds = getBookingSplitRounds(booking);
    const alreadyPaid = rounds.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    // Calculate full order total from items
    const subtotal = (orderItems || []).reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0)), 0);
    const tax = includeTax ? subtotal * 0.07 : 0;
    const fullOrderTotal = Math.ceil(subtotal + tax);

    // If orderItems is empty, fallback to booking.total_amount if available
    let computedTotal = fullOrderTotal;
    if (computedTotal === 0 && booking?.total_amount && parseFloat(booking.total_amount) > 0) {
        computedTotal = Math.ceil(parseFloat(booking.total_amount));
    }

    let remainingBalance = Math.max(0, computedTotal - alreadyPaid);
    
    // In case items were already deleted from DB in ITEMS mode, computedTotal might equal remaining
    if (rounds.length > 0 && computedTotal < alreadyPaid) {
        remainingBalance = computedTotal;
    }

    const currentRoundNumber = rounds.length + 1;
    const isFullySettled = remainingBalance <= 0;

    return {
        fullOrderTotal: computedTotal,
        subtotal,
        tax,
        alreadyPaid,
        remainingBalance,
        currentRoundNumber,
        rounds,
        isFullySettled
    };
}

/**
 * Calculate Baht amount from a percentage (rounded to integer Baht, capped to base amount)
 * @param {number|string} percent - Percentage value (e.g. 25, 33.33, 50, 100)
 * @param {number} baseAmount - Base amount in Baht (remaining or total)
 * @returns {number} Calculated Baht amount
 */
export function calculatePercentAmount(percent, baseAmount) {
    const p = parseFloat(percent) || 0;
    const base = Math.max(0, parseFloat(baseAmount) || 0);
    if (p <= 0 || base <= 0) return 0;
    if (p >= 100) return base;
    return Math.min(base, Math.ceil((base * p) / 100));
}

/**
 * Append a new split round to staff remark and format backward-compatible summary tags
 * @param {string} currentRemark - Existing staff_remark string
 * @param {Object} newRound - { amount, method, mode, percent, payer, splitBookingId, time }
 * @returns {string} Enriched staff_remark string
 */
export function appendSplitRoundToRemark(currentRemark = '', newRound = {}) {
    const rounds = getBookingSplitRounds({ staff_remark: currentRemark });
    const nextRoundNum = rounds.length + 1;

    const roundEntry = {
        round: nextRoundNum,
        amount: Math.max(0, parseFloat(newRound.amount) || 0),
        method: (newRound.method || 'qr').toLowerCase(),
        mode: newRound.mode || 'CUSTOM',
        percent: newRound.percent !== undefined && newRound.percent !== null ? parseFloat(newRound.percent) : null,
        payer: newRound.payer || null,
        time: newRound.time || new Date().toISOString(),
        splitBookingId: newRound.splitBookingId || null
    };

    const updatedRounds = [...rounds, roundEntry];

    // Clean out previous split tags from remark string
    let baseRemark = (currentRemark || '')
        .replace(/\[SPLIT_ROUNDS:\s*\[.*?\]\s*\]/gis, '')
        .replace(/\[SPLIT:[^\]]+\]/gi, '')
        .replace(/Partial Split Paid ฿\d+(?:\.\d+)?/gi, '')
        .replace(/Split \(Round \d+\/\d+[^)]*\) Paid by \w+/gi, '')
        .replace(/Split \([^)]+\) Paid by \w+/gi, '')
        .trim();

    // 1. JSON-encoded round list tag
    const jsonTag = `[SPLIT_ROUNDS: ${JSON.stringify(updatedRounds)}]`;

    // 2. Summary tag for shift helper compatibility: [SPLIT: CASH=X, QR=Y, CREDIT=Z]
    let cashSum = 0, qrSum = 0, creditSum = 0;
    updatedRounds.forEach(r => {
        if (r.method === 'cash') cashSum += r.amount;
        else if (r.method === 'credit') creditSum += r.amount;
        else qrSum += r.amount;
    });
    const summaryTag = `[SPLIT: CASH=${cashSum}, QR=${qrSum}, CREDIT=${creditSum}]`;

    return `${baseRemark ? baseRemark + ' ' : ''}${jsonTag} ${summaryTag}`.trim();
}
