/**
 * WMA Native Socket Bridge Handler for Sunmi D2s Plus
 * Listens for raw ESC/POS print streams intercepted on Port 9100 inside the Android APK,
 * and intercepts Android system notifications from Wongnai / LINE MAN.
 */

import { supabase } from '../lib/supabaseClient';
import { decodeAndParseWmaBuffer, parseWmaNotification } from './wmaParser';
import { printToSunmiBuiltIn } from './printerHelper';
import { playSystemAlertSound } from './audioHelper';
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
        if (!order || ((!order.items || order.items.length === 0) && !order.order_id)) {
            console.log('[WMA Bridge] Received non-order raw print stream.');
            // Still forward to Sunmi printer
            try {
                await printToSunmiBuiltIn(rawBytes);
            } catch (e) {}
            return;
        }

        return await saveWmaOrderToSupabase(order, rawBytes);
    } catch (err) {
        console.error('[WMA Bridge] Error processing intercepted order:', err);
    }
}

export async function processIncomingWmaNotification(notificationObj) {
    try {
        if (!notificationObj || (!notificationObj.title && !notificationObj.text)) return;
        const parsed = parseWmaNotification(notificationObj.title, notificationObj.text);
        if (!parsed) return;

        console.log('[WMA Bridge] Intercepted Notification Order:', parsed);
        return await saveWmaOrderToSupabase(parsed, null);
    } catch (err) {
        console.error('[WMA Bridge] Error processing intercepted notification:', err);
    }
}

export async function saveWmaOrderToSupabase(order, rawBytes = null) {
    console.log('[WMA Bridge] Intercepted LINE MAN Order:', order);
    
    // Play loud notification sound immediately
    try {
        playSystemAlertSound('ring', 3000);
    } catch (e) {}

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
                options.push({ name: `[LINE MAN: ${item.name}]` });
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

    // 4. Dispatch event to active React UI (POSOnlineHub, POSDashboard)
    try {
        window.dispatchEvent(new CustomEvent('wma_order_received', { detail: { booking: newBooking, order } }));
    } catch (e) {}

    // 5. Print directly to Sunmi Built-in Printer if raw stream exists
    if (rawBytes) {
        try {
            await printToSunmiBuiltIn(rawBytes);
        } catch (printErr) {
            console.warn('[WMA Bridge] Auto-print to Sunmi built-in failed:', printErr);
        }
    }

    return newBooking;
}

/**
 * Diagnostic test simulation to verify WMA interception pipeline
 */
export async function simulateWmaOrder(customData = {}) {
    const mockShortId = Math.floor(1000 + Math.random() * 9000).toString();
    const mockOrder = {
        source: 'lineman',
        order_id: `#LM-${mockShortId}`,
        short_id: mockShortId,
        created_at: new Date().toISOString(),
        customer_name: customData.customer_name || 'K. Somchai (Simulated Test)',
        customer_phone: '089-123-4567',
        customer_note: 'แยกน้ำแข็ง ขอหวานน้อย (WMA Test Simulation)',
        rider_name: 'นเรศ ปานทอง (081-999-8877)',
        items: [
            {
                name: 'ชาไทยเย็น',
                quantity: 2,
                price: 130,
                price_at_time: 65,
                selected_options: [{ name: 'หวาน 25%' }],
                special_instructions: 'แยกน้ำแข็ง'
            },
            {
                name: 'ครัวซองต์เนยสด',
                quantity: 1,
                price: 85,
                price_at_time: 85,
                selected_options: [{ name: 'อุ่นร้อน' }],
                special_instructions: ''
            }
        ],
        total_amount: 215,
        subtotal: 215,
        delivery_discount: 0,
        payment_method: 'LINEMAN_PREPAID',
        raw_text: '[SIMULATED MOCK ORDER]'
    };

    return await saveWmaOrderToSupabase(mockOrder, null);
}

export function initWmaNativeBridge() {
    if (isBridgeInitialized) return;
    isBridgeInitialized = true;

    // Expose tester on window for easy developer & console diagnosis
    window.simulateWmaOrder = simulateWmaOrder;

    // Hook global handlers for Android Native Java BridgeActivity
    window.onWmaRawPrintStream = (base64Str) => {
        try {
            const rawBytes = base64ToUint8Array(base64Str);
            processIncomingWmaRawData(rawBytes);
        } catch (e) {
            console.error('[WMA Bridge] Failed to decode base64 stream:', e);
        }
    };

    window.onWmaNotificationOrder = (notificationObj) => {
        try {
            processIncomingWmaNotification(notificationObj);
        } catch (e) {
            console.error('[WMA Bridge] Failed to process notification:', e);
        }
    };

    window.addEventListener('wma_raw_print_stream', (event) => {
        if (event.detail) {
            window.onWmaRawPrintStream(event.detail);
        }
    });

    window.addEventListener('wma_notification_order', (event) => {
        if (event.detail) {
            window.onWmaNotificationOrder(event.detail);
        }
    });

    console.log('🚀 [WMA Bridge] Native Sunmi WMA & Notification listener initialized.');
}
