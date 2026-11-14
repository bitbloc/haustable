import { supabase } from '../lib/supabaseClient';

/**
 * Save a scanned code for a stock item. The first code of an item goes in
 * stock_items.barcode; further codes, or codes that count more than one unit per
 * scan (a case), go in stock_item_barcodes.
 * Returns { ok, kind: 'main' | 'extra', row, message }.
 */
export const linkBarcodeToItem = async ({ item, code, perScan = 1, performedBy = 'Staff' }) => {
    try {
        if (!item.barcode && perScan === 1) {
            const { data, error } = await supabase.from('stock_items')
                .update({ barcode: code }).eq('id', item.id).is('barcode', null).select('id');
            if (error) throw error;
            if (!data?.length) throw new Error('item already has a barcode');
            return { ok: true, kind: 'main', row: null, message: '' };
        }
        const row = { barcode: code, stock_item_id: item.id, units_per_scan: perScan, created_by: performedBy };
        const { error } = await supabase.from('stock_item_barcodes').insert(row);
        if (error) throw error;
        return { ok: true, kind: 'extra', row, message: '' };
    } catch (err) {
        const text = `${err?.code || ''} ${err?.message || ''}`;
        const message = /23505|duplicate|already/i.test(text)
            ? 'บาร์โค้ดนี้ผูกกับรายการอื่นแล้ว'
            : /42P01|PGRST205|stock_item_barcodes/i.test(text)
                ? 'รายการนี้มีบาร์โค้ดแล้ว ต้องติดตั้ง migration บาร์โค้ดเพิ่มเติมก่อนผูกโค้ดที่สอง'
                : 'ผูกบาร์โค้ดไม่สำเร็จ: ' + (err?.message || '');
        return { ok: false, kind: null, row: null, message };
    }
};
