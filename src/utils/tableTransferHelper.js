/**
 * tableTransferHelper.js
 * Centralized parsing and formatting utility for Table Move (ย้ายโต๊ะ) & Table Merge (รวมโต๊ะ)
 * Follows Dieter Rams & Thai Modern OKLCH architecture.
 */

/**
 * Parses all table transfer, move, and merge metadata from booking records and remarks.
 * @param {Object} booking - Booking object containing staff_remark, customer_note, status, etc.
 * @returns {Object} Parsed transfer information
 */
export function parseTableTransferInfo(booking) {
    if (!booking) {
        return {
            isMergedSource: false,
            mergedToTable: null,
            isMergedTarget: false,
            mergedFromTables: [],
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
    let originalTotal = 0;

    // Pattern 1: [MERGED_TO:H4] or [MERGED_TO: Table H4]
    const mergedToMatch = fullText.match(/\[MERGED_TO:\s*([^\]]+)\]/i);
    if (mergedToMatch) {
        isMergedSource = true;
        mergedToTable = mergedToMatch[1].replace(/^(?:table|โต๊ะ)\s*/i, '').trim();
    } else {
        // Pattern 2: "Merged into Table H4" or "รวมเข้าโต๊ะ H4" or "รวมบิลเข้าโต๊ะ H4"
        const textMergedMatch = fullText.match(/(?:merged\s+into\s+table|รวมเข้า(?:กับ)?โต๊ะ|รวมบิลเข้าโต๊ะ)\s*([A-Za-z0-9\-_]+)/i);
        if (textMergedMatch) {
            isMergedSource = true;
            mergedToTable = textMergedMatch[1].trim();
        } else if (fullTextLower.includes('merged offline') || fullTextLower.includes('รวมโต๊ะ')) {
            isMergedSource = true;
            mergedToTable = 'โต๊ะหลัก';
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

    // Pattern: [MERGED_FROM:H3] or multiple [MERGED_FROM:H3,H5]
    const mergedFromMatches = [...fullText.matchAll(/\[MERGED_FROM:\s*([^\]]+)\]/gi)];
    if (mergedFromMatches.length > 0) {
        isMergedTarget = true;
        mergedFromMatches.forEach(m => {
            const tbls = m[1].split(/[,+]/).map(t => t.replace(/^(?:table|โต๊ะ)\s*/i, '').trim()).filter(Boolean);
            mergedFromTables.push(...tbls);
        });
    }

    // Also check text pattern "รวมจากโต๊ะ H3" or "รวมรายการจาก H3"
    const textMergedFromMatch = fullText.match(/(?:รวมจากโต๊ะ|รวมรายการจากโต๊ะ|merged\s+from\s+table)\s*([A-Za-z0-9\-_]+)/i);
    if (textMergedFromMatch && !mergedFromTables.includes(textMergedFromMatch[1].trim())) {
        isMergedTarget = true;
        mergedFromTables.push(textMergedFromMatch[1].trim());
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
        .replace(/\[MERGED_FROM:[^\]]+\]/gi, '')
        .replace(/\[MOVED:[^\]]+\]/gi, '')
        .replace(/\[ORIG(?:_AMT|INAL_TOTAL):[^\]]+\]/gi, '')
        .replace(/\[CALL_STAFF\]/gi, '')
        .replace(/\[CALL_BILL\]/gi, '')
        .replace(/\[CASH:[^\]]+\]/gi, '')
        .replace(/\[SPLIT:[^\]]+\]/gi, '')
        .replace(/\[ONLINE\]/gi, '')
        .replace(/Merged into Table\s+[A-Za-z0-9\-_]+/gi, '')
        .replace(/Merged offline/gi, '')
        .trim();

    return {
        isMergedSource,
        mergedToTable,
        isMergedTarget,
        mergedFromTables: [...new Set(mergedFromTables)],
        isMoved,
        movedFromTable,
        movedToTable,
        moveTimestamp,
        originalTotal,
        cleanRemark
    };
}

/**
 * Format structured remark for Source booking when merging into target table
 */
export function formatMergeSourceRemark(targetTableName, originalTotal = 0) {
    const safeTarget = String(targetTableName || '').trim();
    const origTag = originalTotal > 0 ? ` [ORIG_AMT:${originalTotal}]` : '';
    return `[MERGED_TO:${safeTarget}] Merged into Table ${safeTarget}${origTag}`.trim();
}

/**
 * Format structured remark for Target booking when receiving merged items from source table
 */
export function formatMergeTargetRemark(existingRemark = '', sourceTableName) {
    const safeSource = String(sourceTableName || '').trim();
    const currentRemark = String(existingRemark || '').trim();
    const tag = `[MERGED_FROM:${safeSource}]`;
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
        .replace(/\[MERGED_FROM:[^\]]+\]/gi, '')
        .replace(/\[MOVED:[^\]]+\]/gi, '')
        .replace(/\[ORIG(?:_AMT|INAL_TOTAL):[^\]]+\]/gi, '')
        .replace(/\[CALL_STAFF\]/gi, '')
        .replace(/\[CALL_BILL\]/gi, '')
        .replace(/\[CASH:[^\]]+\]/gi, '')
        .replace(/\[SPLIT:[^\]]+\]/gi, '')
        .replace(/\[ONLINE\]/gi, '')
        .replace(/Merged into Table\s+[A-Za-z0-9\-_]+/gi, '')
        .replace(/Merged offline/gi, '')
        .trim();
}
