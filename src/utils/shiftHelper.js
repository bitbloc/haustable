const CURRENT_SHIFT_KEY = 'pos_current_shift';
const SHIFT_HISTORY_KEY = 'pos_shift_history';

// 1. Get current active shift
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

// 2. Start a new shift
export function startShift(staffName, openingFloat) {
    const floatAmount = parseFloat(openingFloat) || 0;
    const newShift = {
        id: `shift_${Date.now()}`,
        staffName,
        openedAt: new Date().toISOString(),
        openingFloat: floatAmount,
        transactions: [],
        status: 'open',
        closedAt: null,
        closedCash: 0,
        expectedCash: floatAmount,
        difference: 0
    };
    localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(newShift));
    console.log('[Shift Management] Shift started:', newShift);
    
    // Dispatch event to notify layout/POS
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
        paymentMethod: paymentMethod.toLowerCase(), // 'cash' or 'qr'
        timestamp: new Date().toISOString()
    };
    
    shift.transactions.push(newTx);
    
    // Update expected cash in drawer
    if (newTx.paymentMethod === 'cash') {
        shift.expectedCash = (shift.expectedCash || shift.openingFloat) + amount;
    }
    
    localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(shift));
    console.log('[Shift Management] Transaction recorded in shift:', newTx);
    
    window.dispatchEvent(new Event('pos-shift-changed'));
}

// 4. Close the current shift
export function closeShift(actualCash) {
    const shift = getCurrentShift();
    if (!shift) return null;
    
    const cashActual = parseFloat(actualCash) || 0;
    
    // Calculate totals
    const cashSales = shift.transactions
        .filter(tx => tx.paymentMethod === 'cash')
        .reduce((sum, tx) => sum + tx.amount, 0);
        
    const qrSales = shift.transactions
        .filter(tx => tx.paymentMethod === 'qr')
        .reduce((sum, tx) => sum + tx.amount, 0);
        
    const totalSales = cashSales + qrSales;
    const expectedCashInDrawer = shift.openingFloat + cashSales;
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
        totalSales
    };
    
    // Move to history
    try {
        const history = JSON.parse(localStorage.getItem(SHIFT_HISTORY_KEY)) || [];
        history.unshift(closedShift);
        localStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(history.slice(0, 100))); // Keep last 100
    } catch (e) {
        console.error('Failed to save shift to history:', e);
    }
    
    // Clear active shift
    localStorage.removeItem(CURRENT_SHIFT_KEY);
    console.log('[Shift Management] Shift closed:', closedShift);
    
    window.dispatchEvent(new Event('pos-shift-changed'));
    return closedShift;
}

// 5. Get shift logs history
export function getShiftHistory() {
    try {
        return JSON.parse(localStorage.getItem(SHIFT_HISTORY_KEY)) || [];
    } catch {
        return [];
    }
}
