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
        adjustments: [], // petty cash adjustments: { amount, note, type: 'in'|'out', timestamp }
        status: 'open',
        closedAt: null,
        closedCash: 0,
        expectedCash: floatAmount,
        difference: 0
    };
    localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(newShift));
    console.log('[Shift Management] Shift started:', newShift);
    
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
    
    // Recalculate expected cash
    if (newTx.paymentMethod === 'cash') {
        const cashSales = shift.transactions
            .filter(tx => tx.paymentMethod === 'cash')
            .reduce((sum, tx) => sum + tx.amount, 0);
        const adjustments = shift.adjustments || [];
        const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
        const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);
        
        shift.expectedCash = shift.openingFloat + cashSales + totalIn - totalOut;
    }
    
    localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(shift));
    console.log('[Shift Management] Transaction recorded in shift:', newTx);
    
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
    const adjustments = shift.adjustments || [];
    const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
    const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);
    
    shift.expectedCash = shift.openingFloat + cashSales + totalIn - totalOut;
    
    localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(shift));
    console.log('[Shift Management] Cash adjustment recorded:', newAdj);
    
    window.dispatchEvent(new Event('pos-shift-changed'));
    return shift;
}

// 5. Close the current shift
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
    
    const adjustments = shift.adjustments || [];
    const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
    const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);
    
    const expectedCashInDrawer = shift.openingFloat + cashSales + totalIn - totalOut;
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
        totalSales,
        totalIn,
        totalOut,
        adjustments
    };
    
    // Move to history
    try {
        const history = JSON.parse(localStorage.getItem(SHIFT_HISTORY_KEY)) || [];
        history.unshift(closedShift);
        localStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
    } catch (e) {
        console.error('Failed to save shift to history:', e);
    }
    
    // Clear active shift
    localStorage.removeItem(CURRENT_SHIFT_KEY);
    console.log('[Shift Management] Shift closed:', closedShift);
    
    window.dispatchEvent(new Event('pos-shift-changed'));
    return closedShift;
}

// 6. Get shift logs history
export function getShiftHistory() {
    try {
        return JSON.parse(localStorage.getItem(SHIFT_HISTORY_KEY)) || [];
    } catch {
        return [];
    }
}
