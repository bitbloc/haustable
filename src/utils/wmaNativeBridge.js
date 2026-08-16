/**
 * WMA Native Socket Bridge Handler for Sunmi D2s Plus
 * Listens for raw ESC/POS print streams intercepted on Port 9100 inside the Android APK.
 */

import { supabase } from '../lib/supabaseClient';
import { decodeAndParseWmaBuffer } from './wmaParser';
import { printToSunmiBuiltIn } from './printerHelper';
import { toast } from 'sonner';

let isBridgeInitialized = false;

function base64ToUint8Array(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export async function processIncomingWmaRawData(rawBytes) {
    try {
        const order = decodeAndParseWmaBuffer(rawBytes);
        if (!order || (!order.items || order.items.length === 0) && !order.order_id) {
            console.log('[WMA Bridge] Received non-order raw print stream.');
            // Still forward to Sunmi printer
            try {
                await printToSunmiBuiltIn(rawBytes);
            } catch (e) {}
            return;
        }

        console.log('[WMA Bridge] Intercepted LINE MAN Order:', order);
        toast.info(`🛵 ได้รับออเดอร์ LINE MAN #${order.short_id} (฿${order.total_amount})`, {
            duration: 8000
        });

        // 1. Fetch menu items for ID matching
        let menuCache = [];
        try {
            const { data } = await supabase.from('menu_items').select('id, name, price');
            if (data) menuCache = data;
        } catch (e) {}

        const fallbackId = menuCache[0]?.id || 1;

        // 2. Insert Booking
        const bookingPayload = {
            table_id: null,
            status: 'confirmed',
            booking_type: 'pickup',
            booking_time: new Date().toISOString(),
            pax: 1,
            pickup_contact_name: order.customer_name || `LINE MAN #${order.short_id}`,
            pickup_contact_phone: order.customer_phone || '',
            customer_note: order.customer_note || '',
            staff_remark: `[LINEMAN:${order.order_id}] ${order.rider_name ? 'Rider: ' + order.rider_name : ''}`.trim(),
            total_amount: order.total_amount,
            deposit_amount: order.total_amount,
            tracking_token: `LM${order.short_id || ''}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        };

        const { data: newBooking, error: bErr } = await supabase
            .from('bookings')
            .insert(bookingPayload)
            .select()
            .single();

        if (bErr) throw bErr;

        // 3. Insert Order Items
        if (order.items && order.items.length > 0) {
            const itemsPayload = order.items.map(item => {
                const cleanName = (item.name || '').toLowerCase().replace(/[\(\)\[\]]/g, '').trim();
                const matched = menuCache.find(m => m.name.toLowerCase().trim() === cleanName)
                    || menuCache.find(m => cleanName.includes(m.name.toLowerCase().trim()) || m.name.toLowerCase().trim().includes(cleanName));

                const options = [];
                if (!matched) {
                    options.push({ name: `[LINE MAN Item: ${item.name}]` });
                }
                if (item.selected_options) {
                    options.push(...item.selected_options);
                }
                if (item.special_instructions) {
                    options.push({ name: item.special_instructions });
                }

                return {
                    booking_id: newBooking.id,
                    menu_item_id: matched ? matched.id : fallbackId,
                    quantity: item.quantity || 1,
                    price_at_time: item.price_at_time || item.price || (matched ? matched.price : 0),
                    selected_options: options,
                    status: 'pending',
                    is_checked: false
                };
            });

            await supabase.from('order_items').insert(itemsPayload);
        }

        // 4. Print directly to Sunmi Built-in Printer
        try {
            await printToSunmiBuiltIn(rawBytes);
        } catch (printErr) {
            console.warn('[WMA Bridge] Auto-print to Sunmi built-in failed:', printErr);
        }

    } catch (err) {
        console.error('[WMA Bridge] Error processing intercepted order:', err);
    }
}

export function initWmaNativeBridge() {
    if (isBridgeInitialized) return;
    isBridgeInitialized = true;

    // Hook global handler for Android Native Java BridgeActivity
    window.onWmaRawPrintStream = (base64Str) => {
        try {
            const rawBytes = base64ToUint8Array(base64Str);
            processIncomingWmaRawData(rawBytes);
        } catch (e) {
            console.error('[WMA Bridge] Failed to decode base64 stream:', e);
        }
    };

    window.addEventListener('wma_raw_print_stream', (event) => {
        if (event.detail) {
            window.onWmaRawPrintStream(event.detail);
        }
    });

    console.log('🚀 [WMA Bridge] Native Sunmi WMA listener initialized.');
}
