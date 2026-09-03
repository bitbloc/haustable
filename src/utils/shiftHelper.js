import { supabase } from '../lib/supabaseClient';

const CURRENT_SHIFT_KEY = 'pos_current_shift';
const SHIFT_HISTORY_KEY = 'pos_shift_history';

// Helper to breakdown booking payment methods accurately (handling split payments, cash, credit, qr & slips)
export const getBookingPaymentBreakdown = (b) => {
    if (!b) return { cash: 0, qr: 0, credit: 0, isSplit: false, isOnline: false, methodLabel: 'Cash' };
    const total = parseFloat(b.total_amount || b.total_price || 0);
    const remark = (b.staff_remark || '').toLowerCase();
    const explicitMethod = (b.payment_method || '').toLowerCase();
    const orderType = (b.order_type || '').toLowerCase();
    const bookingType = (b.booking_type || '').toLowerCase();

    // Determine if this is an online e-commerce / shipping order
    const isOnline = orderType === 'hausmade_shipping' || (bookingType === 'hausmade' && !b.table_id && orderType !== 'hausmade_pickup');
    
    // 1. Check for split payment annotation in remark, e.g. [SPLIT: CASH=100, QR=200, CREDIT=0]
    const splitMatch = remark.match(/\[split:?\s*([^\]]+)\]/i) || remark.match(/split:\s*([^,\n\]]+(?:,[^,\n\]]+)*)/i);
    if (splitMatch) {
        const splitText = splitMatch[1];
        let cash = 0, qr = 0, credit = 0;
        
        const cashM = splitText.match(/cash[:=\s]+(\d+(?:\.\d+)?)/i);
        if (cashM) cash = parseFloat(cashM[1]) || 0;
        
        const qrM = splitText.match(/(?:qr|transfer|โอน)[:=\s]+(\d+(?:\.\d+)?)/i);
        if (qrM) qr = parseFloat(qrM[1]) || 0;
        
        const creditM = splitText.match(/(?:credit|card|บัตร)[:=\s]+(\d+(?:\.\d+)?)/i);
        if (creditM) credit = parseFloat(creditM[1]) || 0;
        
        return {
            cash,
            qr,
            credit,
            isSplit: true,
            isOnline,
            methodLabel: 'Split (ผสม)'
        };
    }

    // 2. Explicit Cash Check (Must take highest priority over QR-order prefixes and reservation slips)
    if (remark.includes('paid by cash') || remark.includes('[cash:') || remark.includes('เงินสด') || remark.includes('ชำระเงินสด') || explicitMethod === 'cash') {
        return { cash: total, qr: 0, credit: 0, isSplit: false, isOnline, methodLabel: 'Cash' };
    }

    // 3. Explicit Credit Card Check
    if (remark.includes('paid by credit') || remark.includes('[credit:') || remark.includes('paid by card') || remark.includes('บัตรเครดิต') || remark.includes('credit') || explicitMethod === 'credit' || explicitMethod === 'credit_card') {
        return { cash: 0, qr: 0, credit: total, isSplit: false, isOnline, methodLabel: 'Credit Card' };
    }

    // 4. QR / PromptPay / Bank Transfer Check
    if (remark.includes('paid by qr') || remark.includes('paid by transfer') || remark.includes('[qr:') || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน') || remark.includes('promptpay') || remark.includes('สแกนจ่าย') || explicitMethod === 'qr' || explicitMethod === 'promptpay' || explicitMethod === 'transfer') {
        return { cash: 0, qr: total, credit: 0, isSplit: false, isOnline, methodLabel: 'QR Transfer' };
    }

    // 5. Online Deposit / Booking Slip (Only if not settled by in-store cash/credit)
    if (b.payment_slip_url) {
        return { cash: 0, qr: total, credit: 0, isSplit: false, isOnline, methodLabel: 'QR Transfer' };
    }

    // 6. Default In-store Fallback
    return { cash: total, qr: 0, credit: 0, isSplit: false, isOnline, methodLabel: 'Cash' };
};

// Calculate unified, high-precision metrics for active or historical shift
export function calculateShiftMetrics(shift, bookingsData = []) {
    if (!shift) {
        return {
            cashSales: 0,
            qrSales: 0,
            creditSales: 0,
            totalSales: 0,
            inStoreCash: 0,
            inStoreQr: 0,
            inStoreCredit: 0,
            inStoreSales: 0,
            onlineSales: 0,
            onlineOrdersCount: 0,
            openingFloat: 0,
            totalIn: 0,
            totalOut: 0,
            expectedCash: 0,
            completedBookingsCount: 0
        };
    }

    const completed = (bookingsData || []).filter(b => b && b.status === 'completed');
    let cashSales = 0;
    let qrSales = 0;
    let creditSales = 0;

    let inStoreCash = 0;
    let inStoreQr = 0;
    let inStoreCredit = 0;
    let onlineSales = 0;
    let onlineOrdersCount = 0;

    completed.forEach(b => {
        const breakdown = getBookingPaymentBreakdown(b);
        cashSales += breakdown.cash;
        qrSales += breakdown.qr;
        creditSales += breakdown.credit;

        if (breakdown.isOnline) {
            onlineSales += (breakdown.cash + breakdown.qr + breakdown.credit);
            onlineOrdersCount += 1;
        } else {
            inStoreCash += breakdown.cash;
            inStoreQr += breakdown.qr;
            inStoreCredit += breakdown.credit;
        }
    });

    const adjustments = Array.isArray(shift.adjustments) ? shift.adjustments : [];
    const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const openingFloat = Number(shift.openingFloat ?? shift.opening_cash ?? 0);

    return {
        cashSales,
        qrSales,
        creditSales,
        totalSales: cashSales + qrSales + creditSales,
        inStoreCash,
        inStoreQr,
        inStoreCredit,
        inStoreSales: inStoreCash + inStoreQr + inStoreCredit,
        onlineSales,
        onlineOrdersCount,
        openingFloat,
        totalIn,
        totalOut,
        expectedCash: openingFloat + inStoreCash + totalIn - totalOut,
        completedBookingsCount: completed.length
    };
}

// Helper: Record immutable POS audit trail in cloud
export async function logPosAudit(actionType, { bookingId = null, amount = 0, reason = '', metadata = {} } = {}) {
    try {
        const shift = getCurrentShift();
        const savedStaff = localStorage.getItem('pos_active_staff');
        let staffName = shift?.staffName;
        if (!staffName && savedStaff) {
            try { staffName = JSON.parse(savedStaff).display_name; } catch {}
        }
        if (!staffName) staffName = localStorage.getItem('staff_name') || 'Cashier';
        const shiftId = shift?.id ? String(shift.id) : null;
        
        await supabase.rpc('log_pos_audit_event', {
            p_shift_id: shiftId,
            p_staff_name: staffName,
            p_action_type: actionType,
            p_booking_id: bookingId,
            p_amount: Number(amount) || 0,
            p_reason: reason || null,
            p_metadata: metadata || {}
        });
    } catch (err) {
        console.warn('[Audit Log] Failed to record audit log:', err);
    }
}

// Helper: Sync shift log directly to Supabase cloud in background
export async function syncShiftToCloud(shift) {
    if (!shift || !shift.id) return;
    try {
        const corePayload = {
            id: String(shift.id),
            staff_name: String(shift.staffName || 'Staff'),
            opened_at: shift.openedAt ? new Date(shift.openedAt).toISOString() : new Date().toISOString(),
            closed_at: shift.closedAt ? new Date(shift.closedAt).toISOString() : null,
            opening_float: Number(shift.openingFloat) || 0,
            closed_cash: Number(shift.closedCash) || 0,
            expected_cash: Number(shift.expectedCash) || 0,
            difference: Number(shift.difference) || 0,
            status: String(shift.status || 'open'),
            transactions: Array.isArray(shift.transactions) ? shift.transactions : [],
            adjustments: Array.isArray(shift.adjustments) ? shift.adjustments : [],
            cash_sales: Number(shift.cashSales) || 0,
            qr_sales: Number(shift.qrSales) || 0,
            credit_sales: Number(shift.creditSales) || 0,
            total_sales: Number(shift.totalSales) || 0,
            total_in: Number(shift.totalIn) || 0,
            total_out: Number(shift.totalOut) || 0
        };

        const { error } = await supabase
            .from('pos_shifts')
            .upsert(corePayload);

        if (error) {
            console.warn('[Shift Sync] Supabase upsert error:', error.message || error);
        } else {
            console.log('[Shift Sync] Shift synced successfully to cloud:', shift.id);
        }
    } catch (err) {
        console.error('[Shift Sync] Cloud sync error:', err);
    }
}

// Helper: Validate if a shift was opened recently (within last 20 hours) to prevent restoring stale zombie shifts
export const isShiftRecent = (openedAtIso) => {
    if (!openedAtIso) return false;
    try {
        const openedTime = new Date(openedAtIso).getTime();
        if (isNaN(openedTime)) return false;
        const now = Date.now();
        const hoursDiff = (now - openedTime) / (1000 * 60 * 60);
        // Valid if opened within the last 20 hours and not into future by > 1h
        return hoursDiff >= -1 && hoursDiff < 20;
    } catch {
        return false;
    }
};

// 1. Get current active shift from localStorage
export function getCurrentShift() {
    try {
        const shift = JSON.parse(localStorage.getItem(CURRENT_SHIFT_KEY));
        if (shift && shift.status === 'open' && isShiftRecent(shift.openedAt)) {
            return shift;
        }
        if (shift && (!isShiftRecent(shift.openedAt) || shift.status !== 'open')) {
            localStorage.removeItem(CURRENT_SHIFT_KEY);
        }
        return null;
    } catch {
        return null;
    }
}

// Check and restore active open shift from Supabase cloud if wiped locally or stale
export async function checkAndRestoreActiveShift() {
    try {
        // Query Supabase for all open shifts
        const { data, error } = await supabase
            .from('pos_shifts')
            .select('*')
            .eq('status', 'open')
            .order('opened_at', { ascending: false });

        if (!error && data) {
            // Find recent open shifts vs stale open shifts
            const validOpenShifts = data.filter(s => isShiftRecent(s.opened_at));
            const staleOpenShifts = data.filter(s => !isShiftRecent(s.opened_at));

            // Auto-close any stale open shifts in the cloud
            if (staleOpenShifts.length > 0) {
                const staleIds = staleOpenShifts.map(s => s.id);
                console.log('[Shift Sync] Auto-closing stale orphaned shifts:', staleIds);
                await supabase
                    .from('pos_shifts')
                    .update({ status: 'closed', closed_at: new Date().toISOString() })
                    .in('id', staleIds);
            }

            // If there is more than 1 valid open shift, keep only the newest one and close previous ones
            if (validOpenShifts.length > 1) {
                const duplicateIds = validOpenShifts.slice(1).map(s => s.id);
                console.log('[Shift Sync] Auto-closing duplicate open shifts:', duplicateIds);
                await supabase
                    .from('pos_shifts')
                    .update({ status: 'closed', closed_at: new Date().toISOString() })
                    .in('id', duplicateIds);
            }

            if (validOpenShifts.length > 0) {
                const shiftData = validOpenShifts[0];
                const restoredShift = {
                    id: shiftData.id,
                    staffName: shiftData.staff_name,
                    openedAt: shiftData.opened_at,
                    closedAt: shiftData.closed_at,
                    openingFloat: parseFloat(shiftData.opening_float) || 0,
                    transactions: shiftData.transactions || [],
                    adjustments: shiftData.adjustments || [],
                    status: shiftData.status,
                    closedCash: parseFloat(shiftData.closed_cash) || 0,
                    expectedCash: parseFloat(shiftData.expected_cash) || 0,
                    difference: parseFloat(shiftData.difference) || 0,
                    cashSales: parseFloat(shiftData.cash_sales) || 0,
                    qrSales: parseFloat(shiftData.qr_sales) || 0,
                    creditSales: parseFloat(shiftData.credit_sales) || 0,
                    totalSales: parseFloat(shiftData.total_sales) || 0,
                    totalIn: parseFloat(shiftData.total_in) || 0,
                    totalOut: parseFloat(shiftData.total_out) || 0
                };
                
                // Compare with local shift to prevent unnecessary updates if identical, but if different we update.
                const localShift = getCurrentShift();
                const isDifferent = !localShift || 
                    localShift.id !== restoredShift.id ||
                    (localShift.adjustments || []).length !== (restoredShift.adjustments || []).length ||
                    (localShift.transactions || []).length !== (restoredShift.transactions || []).length;
                
                if (isDifferent) {
                     localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(restoredShift));
                     window.dispatchEvent(new Event('pos-shift-changed'));
                     console.log('[Shift Sync] Synced active shift from cloud:', restoredShift);
                }
                return restoredShift;
            } else {
                // If cloud has no valid open shift, check if local shift is valid and recent
                const localShift = getCurrentShift();
                if (localShift && isShiftRecent(localShift.openedAt)) {
                    console.log('[Shift Sync] Local active shift is recent. Re-syncing to cloud:', localShift);
                    syncShiftToCloud(localShift);
                    return localShift;
                } else if (localShift) {
                    // Stale local shift -> clean up
                    console.log('[Shift Sync] Cleaning up stale local shift:', localShift.id);
                    localStorage.removeItem(CURRENT_SHIFT_KEY);
                    window.dispatchEvent(new Event('pos-shift-changed'));
                    return null;
                }
                return null;
            }
        }
    } catch (err) {
        console.error('[Shift Sync] Failed to check/restore active shift:', err);
    }
    
    // Fallback if offline or error
    const localShift = getCurrentShift();
    if (localShift && isShiftRecent(localShift.openedAt)) {
        return localShift;
    }
    return null;
}

// Clean up all active open shifts in cloud and local storage
export async function cleanUpAllShifts() {
    try {
        await supabase
            .from('pos_shifts')
            .update({ status: 'closed', closed_at: new Date().toISOString() })
            .eq('status', 'open');

        localStorage.removeItem(CURRENT_SHIFT_KEY);
        localStorage.removeItem(SHIFT_HISTORY_KEY);
        window.dispatchEvent(new Event('pos-shift-changed'));
        console.log('[Shift Management] All active shifts cleaned up successfully.');
        return true;
    } catch (err) {
        console.error('[Shift Management] Failed to clean up shifts:', err);
        return false;
    }
}

// Sync completed shift history list from Supabase cloud
export async function syncShiftHistoryFromCloud() {
    try {
        const { data, error } = await supabase
            .from('pos_shifts')
            .select('*')
            .order('opened_at', { ascending: false })
            .limit(50);
        if (!error && data) {
            const history = data.map(item => ({
                id: item.id,
                staffName: item.staff_name,
                openedAt: item.opened_at,
                closedAt: item.closed_at,
                openingFloat: parseFloat(item.opening_float) || 0,
                transactions: item.transactions || [],
                adjustments: item.adjustments || [],
                status: item.status,
                closedCash: parseFloat(item.closed_cash) || 0,
                expectedCash: parseFloat(item.expected_cash) || 0,
                difference: parseFloat(item.difference) || 0,
                cashSales: parseFloat(item.cash_sales) || 0,
                qrSales: parseFloat(item.qr_sales) || 0,
                creditSales: parseFloat(item.credit_sales) || 0,
                totalSales: parseFloat(item.total_sales) || 0,
                totalIn: parseFloat(item.total_in) || 0,
                totalOut: parseFloat(item.total_out) || 0
            }));
            localStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(history));
            return history;
        }
    } catch (err) {
        console.error('[Shift Sync] Failed to sync history from cloud:', err);
    }
    return getShiftHistory();
}

// 2. Start a new shift
export function startShift(staffName, openingFloat) {
    const floatAmount = parseFloat(openingFloat) || 0;
    
    // Close any lingering open shifts in cloud before starting new shift
    supabase
        .from('pos_shifts')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('status', 'open')
        .then(() => {
            console.log('[Shift Management] Prior open shifts in cloud marked closed');
        })
        .catch(err => {
            console.warn('[Shift Management] Error closing prior open shifts in cloud:', err);
        });

    const newShift = {
        id: `shift_${Date.now()}`,
        staffName,
        openedAt: new Date().toISOString(),
        openingFloat: floatAmount,
        transactions: [],
        adjustments: [], // petty cash adjustments: { amount, note, type: 'in'|'out', timestamp }
        status: 'open',
        closedAt: null,
        closedCash: 0,
        expectedCash: floatAmount,
        difference: 0,
        cashSales: 0,
        qrSales: 0,
        creditSales: 0,
        totalSales: 0,
        totalIn: 0,
        totalOut: 0
    };
    localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(newShift));
    console.log('[Shift Management] Shift started:', newShift);
    
    // Sync to cloud & log audit
    syncShiftToCloud(newShift);
    logPosAudit('open_shift', { amount: floatAmount, reason: `Staff ${staffName} opened shift with float ฿${floatAmount}` });

    window.dispatchEvent(new Event('pos-shift-changed'));
    return newShift;
}

// 3. Record a checkout transaction in the active shift
export function recordShiftTransaction(bookingId, totalAmount, paymentMethod) {
    const shift = getCurrentShift();
    if (!shift) {
        console.warn('[Shift Management] No active shift to record transaction');
        return;
    }
    
    const amount = parseFloat(totalAmount) || 0;
    const newTx = {
        bookingId,
        amount,
        paymentMethod: paymentMethod.toLowerCase(), // 'cash', 'qr', or 'credit'
        timestamp: new Date().toISOString()
    };
    
    shift.transactions.push(newTx);
    
    // Recalculate cash, qr, credit sales & expected cash
    const cashSales = shift.transactions
        .filter(tx => tx.paymentMethod === 'cash')
        .reduce((sum, tx) => sum + tx.amount, 0);
    const qrSales = shift.transactions
        .filter(tx => tx.paymentMethod === 'qr')
        .reduce((sum, tx) => sum + tx.amount, 0);
    const creditSales = shift.transactions
        .filter(tx => tx.paymentMethod === 'credit')
        .reduce((sum, tx) => sum + tx.amount, 0);
        
    const adjustments = shift.adjustments || [];
    const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
    const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);
    
    shift.cashSales = cashSales;
    shift.qrSales = qrSales;
    shift.creditSales = creditSales;
    shift.totalSales = cashSales + qrSales + creditSales;
    shift.totalIn = totalIn;
    shift.totalOut = totalOut;
    shift.expectedCash = shift.openingFloat + cashSales + totalIn - totalOut;
    
    localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(shift));
    console.log('[Shift Management] Transaction recorded in shift:', newTx);
    
    // Sync to cloud
    syncShiftToCloud(shift);

    window.dispatchEvent(new Event('pos-shift-changed'));
}

// Void a transaction in the active shift
export function voidShiftTransaction(bookingId) {
    const shift = getCurrentShift();
    if (!shift) {
        console.warn('[Shift Management] No active shift to void transaction');
        return;
    }
    
    const originalLength = shift.transactions.length;
    const targetTx = shift.transactions.find(tx => tx.bookingId === bookingId);
    shift.transactions = shift.transactions.filter(tx => tx.bookingId !== bookingId);
    
    if (shift.transactions.length === originalLength) {
        console.warn('[Shift Management] Transaction not found in active shift:', bookingId);
        return;
    }
    
    // Recalculate cash, qr, credit sales & expected cash
    const cashSales = shift.transactions
        .filter(tx => tx.paymentMethod === 'cash')
        .reduce((sum, tx) => sum + tx.amount, 0);
    const qrSales = shift.transactions
        .filter(tx => tx.paymentMethod === 'qr')
        .reduce((sum, tx) => sum + tx.amount, 0);
    const creditSales = shift.transactions
        .filter(tx => tx.paymentMethod === 'credit')
        .reduce((sum, tx) => sum + tx.amount, 0);
        
    const adjustments = shift.adjustments || [];
    const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
    const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);
    
    shift.cashSales = cashSales;
    shift.qrSales = qrSales;
    shift.creditSales = creditSales;
    shift.totalSales = cashSales + qrSales + creditSales;
    shift.totalIn = totalIn;
    shift.totalOut = totalOut;
    shift.expectedCash = shift.openingFloat + cashSales + totalIn - totalOut;
    
    localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(shift));
    console.log('[Shift Management] Transaction voided in shift:', bookingId);
    
    // Sync to cloud & log audit
    syncShiftToCloud(shift);
    logPosAudit('void_transaction', {
        bookingId,
        amount: targetTx?.amount || 0,
        reason: `Voided transaction for booking ${bookingId}`,
        metadata: targetTx || {}
    });

    window.dispatchEvent(new Event('pos-shift-changed'));
}


// 4. Add cash adjustment (petty cash in/out)
export function addShiftAdjustment(amount, note, type) {
    const shift = getCurrentShift();
    if (!shift) return null;
    
    const adjAmount = parseFloat(amount) || 0;
    const newAdj = {
        id: `adj_${Date.now()}`,
        amount: adjAmount,
        note: note || '',
        type, // 'in' or 'out'
        timestamp: new Date().toISOString()
    };
    
    if (!shift.adjustments) {
        shift.adjustments = [];
    }
    shift.adjustments.push(newAdj);
    
    // Recalculate expected cash in drawer
    const txCashSales = (shift.transactions || [])
        .filter(tx => tx.paymentMethod === 'cash')
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const txQrSales = (shift.transactions || [])
        .filter(tx => tx.paymentMethod === 'qr')
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const txCreditSales = (shift.transactions || [])
        .filter(tx => tx.paymentMethod === 'credit')
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        
    const adjustments = shift.adjustments || [];
    const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    
    const cashSales = Math.max(Number(shift.cashSales || 0), txCashSales);
    const qrSales = Math.max(Number(shift.qrSales || 0), txQrSales);
    const creditSales = Math.max(Number(shift.creditSales || 0), txCreditSales);

    shift.cashSales = cashSales;
    shift.qrSales = qrSales;
    shift.creditSales = creditSales;
    shift.totalSales = cashSales + qrSales + creditSales;
    shift.totalIn = totalIn;
    shift.totalOut = totalOut;
    shift.expectedCash = (Number(shift.openingFloat) || 0) + cashSales + totalIn - totalOut;
    
    localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(shift));
    console.log('[Shift Management] Cash adjustment recorded:', newAdj);
    
    // Sync to cloud & log audit
    syncShiftToCloud(shift);
    logPosAudit('cash_adjustment', {
        amount: adjAmount,
        reason: `${type === 'in' ? 'Deposit' : 'Payout'}: ${note}`,
        metadata: newAdj
    });

    window.dispatchEvent(new Event('pos-shift-changed'));
    return shift;
}

// 5. Close the current shift
export function closeShift(actualCash, computedSummary = null) {
    const shift = getCurrentShift();
    if (!shift) return null;
    
    const cashActual = parseFloat(actualCash) || 0;
    
    // Calculate totals or use computedSummary
    const cashSales = computedSummary ? computedSummary.cashSales : shift.transactions
        .filter(tx => tx.paymentMethod === 'cash')
        .reduce((sum, tx) => sum + tx.amount, 0);
        
    const qrSales = computedSummary ? computedSummary.qrSales : shift.transactions
        .filter(tx => tx.paymentMethod === 'qr')
        .reduce((sum, tx) => sum + tx.amount, 0);
        
    const creditSales = computedSummary ? computedSummary.creditSales : shift.transactions
        .filter(tx => tx.paymentMethod === 'credit')
        .reduce((sum, tx) => sum + tx.amount, 0);
        
    const totalSales = cashSales + qrSales + creditSales;
    
    const adjustments = Array.isArray(shift.adjustments) ? shift.adjustments : [];
    const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const openingFloat = Number(shift.openingFloat) || 0;
    const expectedCashInDrawer = openingFloat + cashSales + totalIn - totalOut;
    const diff = cashActual - expectedCashInDrawer;
    
    const closedShift = {
        ...shift,
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedCash: cashActual,
        expectedCash: expectedCashInDrawer,
        difference: diff,
        cashSales,
        qrSales,
        creditSales,
        totalSales,
        totalIn,
        totalOut,
        adjustments
    };
    
    // Move to history locally
    try {
        const history = JSON.parse(localStorage.getItem(SHIFT_HISTORY_KEY)) || [];
        history.unshift(closedShift);
        localStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
    } catch (e) {
        console.error('Failed to save shift to history:', e);
    }
    
    // Sync the closed state to cloud & log audit
    syncShiftToCloud(closedShift);
    logPosAudit('close_shift', {
        amount: cashActual,
        reason: `Closed shift. Expected: ฿${expectedCashInDrawer}, Actual: ฿${cashActual}, Difference: ฿${diff}`,
        metadata: { expectedCash: expectedCashInDrawer, actualCash: cashActual, diff, totalSales }
    });

    // Clear active shift locally
    localStorage.removeItem(CURRENT_SHIFT_KEY);
    console.log('[Shift Management] Shift closed:', closedShift);
    
    window.dispatchEvent(new Event('pos-shift-changed'));
    return closedShift;
}

// 6. Get shift logs history from local storage
export function getShiftHistory() {
    try {
        return JSON.parse(localStorage.getItem(SHIFT_HISTORY_KEY)) || [];
    } catch {
        return [];
    }
}
