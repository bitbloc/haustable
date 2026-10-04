/**
 * tableTransferHelper.js
 * Centralized parsing and formatting utility for Table Move (ย้ายโต๊ะ) & Table Merge (รวมโต๊ะ)
 * Follows Dieter Rams & Thai Modern OKLCH architecture.
 */

import { getShortBookingId } from './printerHelper';

/**
 * Parses all table transfer, move, and merge metadata from booking records and remarks.
 * @param {Object} booking - Booking object containing staff_remark, customer_note, status, etc.
 * @param {Array} allBookings - Optional list of bookings to auto-resolve target/source short bill IDs if not explicit in remarks.
 * @returns {Object} Parsed transfer information
 */
export function parseTableTransferInfo(booking, allBookings = []) {
    if (!booking) {
        return {
            isMergedSource: false,
            mergedToTable: null,
            mergedToBillId: null,
            targetTableDisplay: '',
            isMergedTarget: false,
            mergedFromTables: [],
            mergedFromBillIds: [],
            mergedFromTableDisplay: '',
            isMoved: false,
            movedFromTable: null,
            movedToTable: null,
            moveTimestamp: null,
            originalTotal: 0,
            cleanRemark: ''
        };
    }

    const remark = String(booking.staff_remark || '');
    const note = String(booking.customer_note || '');
    const fullText = `${remark} ${note}`.trim();
    const fullTextLower = fullText.toLowerCase();

    // 1. Check if this booking is a Source Merged Bill (บิลต้นทางที่ถูกรวมไปโต๊ะอื่น)
    let isMergedSource = false;
    let mergedToTable = null;
    let mergedToBillId = null;
    let originalTotal = 0;

    // Check for explicit TARGET_BILL tag e.g. [TARGET_BILL:#77F8] or [TARGET_BILL:77F8]
    const targetBillTagMatch = fullText.match(/\[TARGET_BILL:\s*#?([A-Za-z0-9]+)\]/i);
    if (targetBillTagMatch) {
        mergedToBillId = targetBillTagMatch[1].toUpperCase();
    }

    // Pattern 1: [MERGED_TO:H4#77F8] or [MERGED_TO:H4(#77F8)] or [MERGED_TO:H4]
    const mergedToMatch = fullText.match(/\[MERGED_TO:\s*([^\]]+)\]/i);
    if (mergedToMatch) {
        isMergedSource = true;
        const rawTarget = mergedToMatch[1].replace(/^(?:table|โต๊ะ)\s*/i, '').trim();
        const subIdMatch = rawTarget.match(/^([A-Za-z0-9\-_]+)(?:[#\(]([A-Za-z0-9]+)\)?)?/i);
        if (subIdMatch) {
            mergedToTable = subIdMatch[1].trim();
            if (!mergedToBillId && subIdMatch[2]) {
                mergedToBillId = subIdMatch[2].toUpperCase();
            }
        } else {
            mergedToTable = rawTarget;
        }
    } else {
        // Pattern 2: "Merged into Table H4 (#77F8)" or "รวมเข้าโต๊ะ H4"
        const textMergedMatch = fullText.match(/(?:merged\s+into\s+table|รวมเข้า(?:กับ)?โต๊ะ|รวมบิลเข้าโต๊ะ)\s*([A-Za-z0-9\-_]+)(?:\s*[\(#]([A-Za-z0-9]+)\)?)?/i);
        if (textMergedMatch) {
            isMergedSource = true;
            mergedToTable = textMergedMatch[1].trim();
            if (!mergedToBillId && textMergedMatch[2]) {
                mergedToBillId = textMergedMatch[2].toUpperCase();
            }
        } else if (fullTextLower.includes('merged offline') || fullTextLower.includes('รวมโต๊ะ')) {
            isMergedSource = true;
            mergedToTable = 'โต๊ะหลัก';
        }
    }

    // Auto-resolve mergedToBillId from allBookings if not explicit in remark
    if (isMergedSource && mergedToTable && !mergedToBillId && Array.isArray(allBookings) && allBookings.length > 0) {
        const currentBookingTime = new Date(booking.booking_time || booking.created_at || Date.now()).getTime();
        const candidate = allBookings.find(b => {
            if (!b || b.id === booking.id) return false;
            const tName = b.tables_layout?.table_name;
            if (!tName || tName.toLowerCase() !== mergedToTable.toLowerCase()) return false;
            if (b.status === 'void' || b.status === 'cancelled') {
                // If it's another void booking, make sure it's not another source
                const subT = parseTableTransferInfo(b);
                if (subT.isMergedSource) return false;
            }
            const bTime = new Date(b.booking_time || b.created_at || Date.now()).getTime();
            // Within 12 hours
            return Math.abs(bTime - currentBookingTime) <= 12 * 3600 * 1000;
        });
        if (candidate) {
            mergedToBillId = getShortBookingId(candidate);
        }
    }

    // Check for original total tag e.g. [ORIG_AMT:851] or [ORIGINAL_TOTAL:851]
    const origAmtMatch = fullText.match(/\[ORIG(?:_AMT|INAL_TOTAL):\s*([0-9.]+)\]/i);
    if (origAmtMatch) {
        originalTotal = parseFloat(origAmtMatch[1]) || 0;
    } else if (isMergedSource) {
        originalTotal = parseFloat(booking.total_amount || booking.total_price || 0);
    }

    // 2. Check if this booking is a Target Merged Bill (บิลปลายทางที่รับการรวมโต๊ะ)
    let isMergedTarget = false;
    const mergedFromTables = [];
    const mergedFromBillIds = [];

    // Pattern: [MERGED_FROM:H3#AC4E] or [MERGED_FROM:H3]
    const mergedFromMatches = [...fullText.matchAll(/\[MERGED_FROM:\s*([^\]]+)\]/gi)];
    if (mergedFromMatches.length > 0) {
        isMergedTarget = true;
        mergedFromMatches.forEach(m => {
            const raw = m[1].trim();
            const parts = raw.split(/[,+]/);
            parts.forEach(p => {
                const subMatch = p.replace(/^(?:table|โต๊ะ)\s*/i, '').trim().match(/^([A-Za-z0-9\-_]+)(?:[#\(]([A-Za-z0-9]+)\)?)?/i);
                if (subMatch) {
                    const tbl = subMatch[1].trim();
                    if (tbl) mergedFromTables.push(tbl);
                    if (subMatch[2]) mergedFromBillIds.push(subMatch[2].toUpperCase());
                }
            });
        });
    }

    // Also check text pattern "รวมจากโต๊ะ H3" or "รวมรายการจาก H3"
    const textMergedFromMatch = fullText.match(/(?:รวมจากโต๊ะ|รวมรายการจากโต๊ะ|merged\s+from\s+table)\s*([A-Za-z0-9\-_]+)(?:\s*[\(#]([A-Za-z0-9]+)\)?)?/i);
    if (textMergedFromMatch && !mergedFromTables.includes(textMergedFromMatch[1].trim())) {
        isMergedTarget = true;
        mergedFromTables.push(textMergedFromMatch[1].trim());
        if (textMergedFromMatch[2]) {
            mergedFromBillIds.push(textMergedFromMatch[2].toUpperCase());
        }
    }

    // Auto-resolve mergedFromBillIds from allBookings if needed
    if (isMergedTarget && mergedFromTables.length > 0 && mergedFromBillIds.length === 0 && Array.isArray(allBookings) && allBookings.length > 0) {
        const targetTableName = booking.tables_layout?.table_name || '';
        mergedFromTables.forEach(fromTbl => {
            const sourceCandidate = allBookings.find(b => {
                if (!b || b.id === booking.id) return false;
                const bTbl = b.tables_layout?.table_name;
                if (!bTbl || bTbl.toLowerCase() !== fromTbl.toLowerCase()) return false;
                const subTransfer = parseTableTransferInfo(b);
                return subTransfer.isMergedSource && subTransfer.mergedToTable?.toLowerCase() === targetTableName.toLowerCase();
            });
            if (sourceCandidate) {
                mergedFromBillIds.push(getShortBookingId(sourceCandidate));
            }
        });
    }

    // 3. Check if this booking was Moved (ย้ายโต๊ะ)
    let isMoved = false;
    let movedFromTable = null;
    let movedToTable = null;
    let moveTimestamp = null;

    // Pattern: [MOVED:H1->H3] or [MOVED:H1->H3@19:30]
    const movedMatch = fullText.match(/\[MOVED:\s*([A-Za-z0-9\-_]+)\s*(?:->|➔|=>|to)\s*([A-Za-z0-9\-_]+)(?:@([^\]]+))?\]/i);
    if (movedMatch) {
        isMoved = true;
        movedFromTable = movedMatch[1].replace(/^(?:table|โต๊ะ)\s*/i, '').trim();
        movedToTable = movedMatch[2].replace(/^(?:table|โต๊ะ)\s*/i, '').trim();
        moveTimestamp = movedMatch[3] ? movedMatch[3].trim() : null;
    } else {
        const textMovedMatch = fullText.match(/(?:ย้ายจากโต๊ะ|ย้ายจาก|moved\s+from)\s*([A-Za-z0-9\-_]+)/i);
        if (textMovedMatch) {
            isMoved = true;
            movedFromTable = textMovedMatch[1].trim();
        }
    }

    // 4. Generate clean human-readable remark without system tags
    const cleanRemark = remark
        .replace(/\[MERGED_TO:[^\]]+\]/gi, '')
        .replace(/\[TARGET_BILL:[^\]]+\]/gi, '')
        .replace(/\[MERGED_FROM:[^\]]+\]/gi, '')
        .replace(/\[SOURCE_BILL:[^\]]+\]/gi, '')
        .replace(/\[MOVED:[^\]]+\]/gi, '')
        .replace(/\[ORIG(?:_AMT|INAL_TOTAL):[^\]]+\]/gi, '')
        .replace(/\[CALL_STAFF\]/gi, '')
        .replace(/\[CALL_BILL\]/gi, '')
        .replace(/\[CASH:[^\]]+\]/gi, '')
        .replace(/\[SPLIT:[^\]]+\]/gi, '')
        .replace(/\[ONLINE\]/gi, '')
        .replace(/Merged into Table\s+[A-Za-z0-9\-_]+(?:\s*\([A-Za-z0-9#]+\))?/gi, '')
        .replace(/Merged offline/gi, '')
        .trim();

    // 5. Pre-formatted display strings for UI
    const targetTableDisplay = mergedToTable 
        ? `โต๊ะ ${mergedToTable}${mergedToBillId ? ` (#${mergedToBillId})` : ''}` 
        : '';

    const uniqueFromTables = [...new Set(mergedFromTables)];
    const uniqueFromBillIds = [...new Set(mergedFromBillIds)];
    const mergedFromTableDisplay = uniqueFromTables.length > 0
        ? uniqueFromTables.map((tbl, idx) => {
            const billId = uniqueFromBillIds[idx] || (uniqueFromBillIds.length === 1 && uniqueFromTables.length === 1 ? uniqueFromBillIds[0] : null);
            return `โต๊ะ ${tbl}${billId ? ` (#${billId})` : ''}`;
        }).join(', ')
        : '';

    return {
        isMergedSource,
        mergedToTable,
        mergedToBillId: mergedToBillId ? (mergedToBillId.startsWith('#') ? mergedToBillId.slice(1) : mergedToBillId) : null,
        targetTableDisplay,
        isMergedTarget,
        mergedFromTables: uniqueFromTables,
        mergedFromBillIds: uniqueFromBillIds,
        mergedFromTableDisplay,
        isMoved,
        movedFromTable,
        movedToTable,
        moveTimestamp,
        originalTotal,
        cleanRemark
    };
}

/**
 * Format structured remark for Source booking when merging into target table with target bill ID
 */
export function formatMergeSourceRemark(targetTableName, targetShortId = null, originalTotal = 0) {
    const safeTarget = String(targetTableName || '').trim();
    const cleanTargetId = targetShortId ? String(targetShortId).replace(/^#/, '').toUpperCase().trim() : '';
    const origTag = originalTotal > 0 ? ` [ORIG_AMT:${originalTotal}]` : '';
    const idTag = cleanTargetId ? ` [TARGET_BILL:#${cleanTargetId}]` : '';
    const textId = cleanTargetId ? ` (#${cleanTargetId})` : '';
    return `[MERGED_TO:${safeTarget}${cleanTargetId ? `#${cleanTargetId}` : ''}]${idTag} Merged into Table ${safeTarget}${textId}${origTag}`.trim();
}

/**
 * Format structured remark for Target booking when receiving merged items from source table
 */
export function formatMergeTargetRemark(existingRemark = '', sourceTableName, sourceShortId = null) {
    const safeSource = String(sourceTableName || '').trim();
    const cleanSourceId = sourceShortId ? String(sourceShortId).replace(/^#/, '').toUpperCase().trim() : '';
    const currentRemark = String(existingRemark || '').trim();
    const tag = `[MERGED_FROM:${safeSource}${cleanSourceId ? `#${cleanSourceId}` : ''}]`;
    if (currentRemark.includes(tag)) return currentRemark;
    return currentRemark ? `${currentRemark} ${tag}` : tag;
}

/**
 * Format structured remark for a Moved booking
 */
export function formatMoveRemark(existingRemark = '', fromTableName, toTableName) {
    const safeFrom = String(fromTableName || '').trim();
    const safeTo = String(toTableName || '').trim();
    const currentRemark = String(existingRemark || '').trim();
    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const tag = `[MOVED:${safeFrom}->${safeTo}@${timeStr}]`;
    return currentRemark ? `${currentRemark} ${tag}` : tag;
}

/**
 * Strips all internal system brackets from staff remark for external printing
 */
export function stripInternalTransferTags(remark = '') {
    if (!remark) return '';
    return String(remark)
        .replace(/\[MERGED_TO:[^\]]+\]/gi, '')
        .replace(/\[TARGET_BILL:[^\]]+\]/gi, '')
        .replace(/\[MERGED_FROM:[^\]]+\]/gi, '')
        .replace(/\[SOURCE_BILL:[^\]]+\]/gi, '')
        .replace(/\[MOVED:[^\]]+\]/gi, '')
        .replace(/\[ORIG(?:_AMT|INAL_TOTAL):[^\]]+\]/gi, '')
        .replace(/\[CALL_STAFF\]/gi, '')
        .replace(/\[CALL_BILL\]/gi, '')
        .replace(/\[CASH:[^\]]+\]/gi, '')
        .replace(/\[SPLIT:[^\]]+\]/gi, '')
        .replace(/\[ONLINE\]/gi, '')
        .replace(/Merged into Table\s+[A-Za-z0-9\-_]+(?:\s*\([A-Za-z0-9#]+\))?/gi, '')
        .replace(/Merged offline/gi, '')
        .trim();
}

/**
 * Checks if a booking is an empty placeholder pickup/takeaway order (0 items and 0 amount).
 * These ghost records occur when a takeaway order is initiated in POS but abandoned without ordering items.
 * @param {Object} booking
 * @returns {boolean}
 */
export function isGhostPickupBooking(booking) {
    if (!booking) return false;
    const isPickupType = !booking.table_id || 
                         booking.booking_type === 'pickup' || 
                         (booking.booking_type || '').includes('takeaway');
    const hasNoItems = !booking.order_items || booking.order_items.length === 0;
    const hasNoAmount = parseFloat(booking.total_amount || booking.total_price || 0) === 0;
    return Boolean(isPickupType && hasNoItems && hasNoAmount);
}

/**
 * Checks if a booking is an empty duplicate ghost table session (0 items, 0 amount) 
 * when another active dining session on the exact same table exists.
 * This occurs if "เปิดโต๊ะ" was rapidly double-clicked in POS, generating two simultaneous
 * seated walk-ins, one of which remained stranded with 0 items while the other received the order.
 * @param {Object} booking
 * @param {Array} allBookings
 * @returns {boolean}
 */
export function isDuplicateGhostBooking(booking, allBookings = []) {
    if (!booking || !booking.table_id) return false;
    const isSeatedOrPending = ['seated', 'pending', 'confirmed'].includes(booking.status);
    if (!isSeatedOrPending) return false;

    const hasNoItems = !booking.order_items || booking.order_items.length === 0;
    const hasNoAmount = parseFloat(booking.total_amount || booking.total_price || 0) === 0;
    if (!hasNoItems || !hasNoAmount) return false;

    if (!Array.isArray(allBookings) || allBookings.length === 0) return false;

    const tableIdStr = String(booking.table_id);
    const thisTime = new Date(booking.booking_time || booking.created_at || 0).getTime();

    // Check if there is another booking for the same table that is also active
    return allBookings.some(other => {
        if (!other || other.id === booking.id) return false;
        if (String(other.table_id) !== tableIdStr) return false;
        if (!['seated', 'pending', 'confirmed'].includes(other.status)) return false;

        const otherHasItems = other.order_items && other.order_items.length > 0;
        const otherHasAmount = parseFloat(other.total_amount || other.total_price || 0) > 0;

        // If the other booking has real ordered items or paid/payable amount, this empty one is a ghost duplicate
        if (otherHasItems || otherHasAmount) return true;

        // If both are 0 items / 0 amount, keep the newer one or break tie by ID
        const otherTime = new Date(other.booking_time || other.created_at || 0).getTime();
        if (otherTime > thisTime) return true;
        if (otherTime === thisTime && String(other.id) > String(booking.id)) return true;

        return false;
    });
}

/**
 * Checks if a booking is an internal maintenance/floor block holding the table.
 * @param {Object} booking
 * @returns {boolean}
 */
export function isInternalBlockBooking(booking) {
    if (!booking) return false;
    const note = booking.customer_note || '';
    const isBlockNote = note === 'Internal Block' || note === 'Maintenance Block';
    const hasNoItems = !booking.order_items || booking.order_items.length === 0;
    const hasNoAmount = parseFloat(booking.total_amount || booking.total_price || 0) === 0;
    return Boolean(isBlockNote && hasNoItems && hasNoAmount);
}

/**
 * Comprehensive check for any ghost, block, or duplicate records that should not appear in active bills
 */
export function isGhostOrDuplicateBooking(booking, allBookings = []) {
    return isGhostPickupBooking(booking) || isInternalBlockBooking(booking) || isDuplicateGhostBooking(booking, allBookings);
}

/**
 * Determines whether a booking is an actively occupying in-store dining session.
 * @param {Object} b - Booking record
 * @param {string} [startOfToday] - ISO string for start of today
 * @param {string} [endOfToday] - ISO string for end of today
 * @param {Date} [now] - Current Date object
 * @returns {boolean}
 */
export function isTableSessionActive(b, startOfToday, endOfToday, now = new Date()) {
    if (!b) return false;
    if (['completed', 'void', 'cancelled', 'no_show'].includes(b.status)) return false;

    // Safety age limit: session cannot exceed 16 hours
    const bRawTime = b.booking_time || b.created_at;
    if (bRawTime) {
        const bTime = new Date(bRawTime);
        const ageMs = now.getTime() - bTime.getTime();
        if (ageMs > 16 * 60 * 60 * 1000) return false;
    }

    // If there is no active shift and the booking belongs to a closed shift, it is not an active dining session
    try {
        const activeShiftStr = typeof localStorage !== 'undefined' ? localStorage.getItem('pos_current_shift') : null;
        if (!activeShiftStr) {
            const historyStr = typeof localStorage !== 'undefined' ? localStorage.getItem('pos_shift_history') : null;
            if (historyStr) {
                const history = JSON.parse(historyStr);
                const latestClosed = Array.isArray(history) && history.length > 0 ? history[0] : null;
                if (latestClosed?.closedAt) {
                    const bTime = new Date(b.booking_time || b.created_at).getTime();
                    const closedTime = new Date(latestClosed.closedAt).getTime();
                    if (bTime <= closedTime) return false;
                }
            }
        }
    } catch (e) {}

    // 1. Actively seated or confirmed in-store session
    if (['seated', 'confirmed'].includes(b.status)) {
        return true;
    }
    // 2. Kitchen ready items
    if (b.status === 'ready' && b.booking_type !== 'pickup') {
        return true;
    }
    // 3. Pending session with items or walk-in/qr
    if (b.status === 'pending') {
        const isWalkInOrQR = b.booking_type === 'walk_in' || b.booking_type === 'qr' || (b.staff_remark || '').toLowerCase().includes('qr');
        const hasItems = Array.isArray(b.order_items) && b.order_items.length > 0;
        return isWalkInOrQR || hasItems || b.booking_type !== 'pickup';
    }
    return false;
}



