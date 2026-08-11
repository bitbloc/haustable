import { supabase } from '../lib/supabaseClient';

const CURRENT_SHIFT_KEY = 'pos_current_shift';
const SHIFT_HISTORY_KEY = 'pos_shift_history';

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

// 1. Get current active shift from localStorage
export function getCurrentShift() {
    try {
        const shift = JSON.parse(localStorage.getItem(CURRENT_SHIFT_KEY));
        if (shift && shift.status === 'open') {
            return shift;
        }
        return null;
    } catch {
        return null;
    }
}

// Check and restore active open shift from Supabase cloud if wiped locally or stale
export async function checkAndRestoreActiveShift() {
    try {
        // Query Supabase for any active open shift (using limit(1) array check to avoid maybeSingle errors)
        const { data, error } = await supabase
            .from('pos_shifts')
            .select('*')
            .eq('status', 'open')
            .order('opened_at', { ascending: false })
            .limit(1);

        if (!error && data) {
            if (data.length > 0) {
                const shiftData = data[0];
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
                if (!localShift || localShift.id !== restoredShift.id) {
                     localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(restoredShift));
                     window.dispatchEvent(new Event('pos-shift-changed'));
                     console.log('[Shift Sync] Synced active shift from cloud:', restoredShift);
                }
                return restoredShift;
            } else {
                // If cloud has no open shift, BUT local shift is active, TRUST and RE-SYNC local shift to cloud!
                const localShift = getCurrentShift();
                if (localShift) {
                    console.log('[Shift Sync] Local active shift exists. Re-syncing local shift to cloud:', localShift);
                    syncShiftToCloud(localShift);
                    return localShift;
                }
                return null;
            }
        }
    } catch (err) {
        console.error('[Shift Sync] Failed to check/restore active shift:', err);
    }
    
    // Fallback if offline or error
    return getCurrentShift();
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
            window.dispatchEvent(new Event('pos-shift-changed'));
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
    
    // Sync to cloud
    syncShiftToCloud(newShift);

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
    
    // Sync to cloud
    syncShiftToCloud(shift);

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
    console.log('[Shift Management] Cash adjustment recorded:', newAdj);
    
    // Sync to cloud
    syncShiftToCloud(shift);

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
    
    const adjustments = shift.adjustments || [];
    const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
    const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);
    
    const expectedCashInDrawer = computedSummary ? computedSummary.expectedCash : (shift.openingFloat + cashSales + totalIn - totalOut);
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
    
    // Sync the closed state to cloud
    syncShiftToCloud(closedShift);

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
