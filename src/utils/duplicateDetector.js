/**
 * Duplicate Receipt & Expense Detection Utility for "IN THE HAUS"
 * Analyzes candidate expenses against existing records using multi-factor heuristics:
 * 1. Exact Amount + Exact Date + Vendor matching
 * 2. Invoice / Receipt Number match
 * 3. Exact Amount + Date Proximity (+- 1 day)
 */

function normalizeText(str) {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .replace(/[\s\-_.,/\\()]/g, '')
        .trim();
}

/**
 * Check if a single candidate expense might be a duplicate of an existing record
 * @param {Object} candidate - { id, amount, expense_date, vendor_name, vendor_tax_id, invoice_no, title, notes }
 * @param {Array} existingList - Array of existing store expenses
 * @returns {Object|null} - { isDuplicate, confidence: 'HIGH'|'MEDIUM', reason: string, matchedRecord: Object }
 */
export function checkDuplicateExpense(candidate, existingList = []) {
    if (!candidate || !candidate.amount || !candidate.expense_date || !existingList || existingList.length === 0) {
        return null;
    }

    const candAmount = Number(candidate.amount);
    if (isNaN(candAmount) || candAmount <= 0) return null;

    const candDate = candidate.expense_date.slice(0, 10);
    const candVendor = normalizeText(candidate.vendor_name || candidate.title || '');
    const candInvoiceNo = normalizeText(candidate.invoice_no || '');
    const candId = candidate.id;

    for (const item of existingList) {
        // Skip comparing against self when editing
        if (candId && item.id === candId) continue;

        const itemAmount = Number(item.amount || 0);
        const itemDate = (item.expense_date || '').slice(0, 10);
        const itemVendor = normalizeText(item.vendor_name || item.title || '');
        const itemInvoiceNo = normalizeText(item.invoice_no || '');
        const itemNotes = normalizeText(item.notes || '');

        // 1. High Confidence: Invoice/Receipt No. exact match
        if (candInvoiceNo && candInvoiceNo.length >= 4) {
            if (itemInvoiceNo === candInvoiceNo || itemNotes.includes(candInvoiceNo)) {
                return {
                    isDuplicate: true,
                    confidence: 'HIGH',
                    reason: `เลขที่บิล/ใบเสร็จตรงกัน (#${candidate.invoice_no})`,
                    matchedRecord: item
                };
            }
        }

        // Check amount equality (within 0.01 tolerance)
        const isSameAmount = Math.abs(candAmount - itemAmount) < 0.05;
        if (!isSameAmount) continue;

        // 2. High Confidence: Same Amount + Same Date + Same/Similar Vendor
        if (itemDate === candDate) {
            const isVendorMatch = 
                !candVendor || !itemVendor ||
                candVendor.includes(itemVendor) || 
                itemVendor.includes(candVendor);

            if (isVendorMatch) {
                return {
                    isDuplicate: true,
                    confidence: 'HIGH',
                    reason: `ยอดเงิน ฿${candAmount.toLocaleString()} ตรงกับรายการวันที่ ${itemDate} จากร้าน "${item.vendor_name || item.title}"`,
                    matchedRecord: item
                };
            }

            // Same date + same amount with different vendor
            return {
                isDuplicate: true,
                confidence: 'MEDIUM',
                reason: `มียอดเงิน ฿${candAmount.toLocaleString()} ในวันที่ ${itemDate} อยู่แล้ว (รายการ: "${item.title}")`,
                matchedRecord: item
            };
        }

        // 3. Medium Confidence: Same Amount + Date Proximity (+- 1 day) + Same Vendor
        if (candVendor && itemVendor && (candVendor.includes(itemVendor) || itemVendor.includes(candVendor))) {
            const candTime = new Date(candDate).getTime();
            const itemTime = new Date(itemDate).getTime();
            const diffDays = Math.abs(candTime - itemTime) / (1000 * 60 * 60 * 24);

            if (diffDays <= 1) {
                return {
                    isDuplicate: true,
                    confidence: 'MEDIUM',
                    reason: `มียอดเงิน ฿${candAmount.toLocaleString()} ใกล้เคียงกันในวันที่ ${itemDate} จากร้าน "${item.vendor_name || item.title}"`,
                    matchedRecord: item
                };
            }
        }
    }

    return null;
}

/**
 * Scan entire ledger and group items that are duplicate pairs/clusters
 * @param {Array} expenses
 * @returns {Map<string, Array<Object>>} Map of duplicate group key to list of records
 */
export function findDuplicateClusters(expenses = []) {
    const duplicateGroups = new Map();
    const visited = new Set();

    for (let i = 0; i < expenses.length; i++) {
        const a = expenses[i];
        if (visited.has(a.id)) continue;

        const cluster = [a];

        for (let j = i + 1; j < expenses.length; j++) {
            const b = expenses[j];
            if (visited.has(b.id)) continue;

            const isAmountSame = Math.abs(Number(a.amount || 0) - Number(b.amount || 0)) < 0.05;
            const isDateSame = (a.expense_date || '').slice(0, 10) === (b.expense_date || '').slice(0, 10);
            
            const vendorA = normalizeText(a.vendor_name || a.title || '');
            const vendorB = normalizeText(b.vendor_name || b.title || '');
            const isVendorSame = !vendorA || !vendorB || vendorA.includes(vendorB) || vendorB.includes(vendorA);

            if (isAmountSame && isDateSame && isVendorSame) {
                cluster.push(b);
                visited.add(b.id);
            }
        }

        if (cluster.length > 1) {
            visited.add(a.id);
            const groupKey = `${(a.expense_date || '').slice(0, 10)}_${Number(a.amount || 0).toFixed(2)}`;
            duplicateGroups.set(groupKey, cluster);
        }
    }

    return duplicateGroups;
}
