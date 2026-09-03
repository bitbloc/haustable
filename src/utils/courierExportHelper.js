/**
 * Courier Export Helper for Flash Express, KEX (Kerry), and Thailand Post
 * Follows Dieter Rams & Thai Modern architectural cleanliness
 */

/**
 * Extract address components from unstructured Thai address string or parsed booking
 */
export function parseAddressComponents(addressStr = '', order = {}) {
    let clean = (addressStr || '').trim();
    let postalCode = '';
    let province = '';
    let district = '';
    let subDistrict = '';
    let addressLine = clean;

    // 1. Extract 5-digit postal code at the end
    const zipMatch = clean.match(/(\b\d{5}\b)$/);
    if (zipMatch) {
        postalCode = zipMatch[1];
        clean = clean.replace(zipMatch[1], '').trim();
    }

    // 2. Extract Province (จ. หรือ จังหวัด)
    const provMatch = clean.match(/(?:จังหวัด|จ\.)\s*([^\s]+)/i);
    if (provMatch) {
        province = provMatch[1];
        clean = clean.replace(provMatch[0], '').trim();
    }

    // 3. Extract District (อ. หรือ อำเภอ หรือ เขต)
    const distMatch = clean.match(/(?:อำเภอ|อ\.|เขต)\s*([^\s]+)/i);
    if (distMatch) {
        district = distMatch[1];
        clean = clean.replace(distMatch[0], '').trim();
    }

    // 4. Extract Sub-district (ต. หรือ ตำบล หรือ แขวง)
    const subMatch = clean.match(/(?:ตำบล|ต\.|แขวง)\s*([^\s]+)/i);
    if (subMatch) {
        subDistrict = subMatch[1];
        clean = clean.replace(subMatch[0], '').trim();
    }

    addressLine = clean.replace(/\s+/g, ' ').trim();

    return {
        recipientName: order.pickup_contact_name || order.customer_name || 'ลูกค้า HAUSMADE',
        phone: (order.pickup_contact_phone || order.customer_phone || order.phone || '').replace(/\D/g, ''),
        addressLine: addressLine || addressStr,
        subDistrict,
        district,
        province,
        postalCode,
        rawAddress: addressStr,
        token: order.tracking_token || order.id || '',
        totalAmount: order.total_amount || 0,
        itemsSummary: (order.order_items || []).map(i => `${i.quantity || 1}x ${i.menu_items?.name || i.custom_name || i.name || 'สินค้า'}`).join('; ')
    };
}

/**
 * Escape field for CSV
 */
function escapeCSV(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
}

/**
 * Trigger CSV download in browser with UTF-8 BOM
 */
export function downloadCSV(csvContent, filename) {
    const bom = '\uFEFF'; // UTF-8 BOM so Thai characters open correctly in Excel
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * 1. Export for Flash Express (Flash Drop-off / Bulk Template)
 */
export function exportFlashExpressCSV(orders = []) {
    const headers = [
        'เลขอ้างอิง (Ref No)',
        'ชื่อผู้รับ (Recipient Name)',
        'เบอร์โทรศัพท์ (Phone)',
        'ที่อยู่ (Address)',
        'ตำบล/แขวง (Sub-district)',
        'อำเภอ/เขต (District)',
        'จังหวัด (Province)',
        'รหัสไปรษณีย์ (Postal Code)',
        'ยอดเก็บเงินปลายทาง COD (บาท)',
        'รายละเอียดสินค้า (Item Name/Remark)'
    ];

    const rows = orders.map(o => {
        const addr = parseAddressComponents(o.shipping_address, o);
        return [
            escapeCSV(addr.token),
            escapeCSV(addr.recipientName),
            escapeCSV(addr.phone),
            escapeCSV(addr.addressLine),
            escapeCSV(addr.subDistrict),
            escapeCSV(addr.district),
            escapeCSV(addr.province),
            escapeCSV(addr.postalCode),
            escapeCSV('0'), // COD 0 (ชำระแล้ว)
            escapeCSV(addr.itemsSummary || 'HAUSMADE Craft Item')
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(csvContent, `flash_express_orders_${dateStr}.csv`);
}

/**
 * 2. Export for KEX (Kerry Express Bulk Upload Template)
 */
export function exportKexCSV(orders = []) {
    const headers = [
        'Recipient Name',
        'Mobile No',
        'Address',
        'Sub-District',
        'District',
        'Province',
        'Postal Code',
        'COD Amount',
        'Declared Value',
        'Remark',
        'Order Ref'
    ];

    const rows = orders.map(o => {
        const addr = parseAddressComponents(o.shipping_address, o);
        return [
            escapeCSV(addr.recipientName),
            escapeCSV(addr.phone),
            escapeCSV(addr.addressLine),
            escapeCSV(addr.subDistrict),
            escapeCSV(addr.district),
            escapeCSV(addr.province),
            escapeCSV(addr.postalCode),
            escapeCSV('0'),
            escapeCSV(addr.totalAmount),
            escapeCSV(addr.itemsSummary || 'HAUSMADE'),
            escapeCSV(addr.token)
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(csvContent, `kex_kerry_orders_${dateStr}.csv`);
}

/**
 * 3. Export for Thailand Post (EMS / Drop-off Template)
 */
export function exportThailandPostCSV(orders = []) {
    const headers = [
        'หมายเลขอ้างอิง',
        'ชื่อผู้รับ',
        'เบอร์โทรศัพท์ผู้รับ',
        'ที่อยู่ผู้รับ',
        'ตำบล/แขวง',
        'อำเภอ/เขต',
        'จังหวัด',
        'รหัสไปรษณีย์',
        'บริการ',
        'เก็บเงินปลายทาง (COD)',
        'หมายเหตุ/รายการของ'
    ];

    const rows = orders.map(o => {
        const addr = parseAddressComponents(o.shipping_address, o);
        return [
            escapeCSV(addr.token),
            escapeCSV(addr.recipientName),
            escapeCSV(addr.phone),
            escapeCSV(addr.addressLine),
            escapeCSV(addr.subDistrict),
            escapeCSV(addr.district),
            escapeCSV(addr.province),
            escapeCSV(addr.postalCode),
            escapeCSV('EMS ในประเทศ'),
            escapeCSV('0'),
            escapeCSV(addr.itemsSummary || 'HAUSMADE Parcel')
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(csvContent, `thailand_post_ems_orders_${dateStr}.csv`);
}
