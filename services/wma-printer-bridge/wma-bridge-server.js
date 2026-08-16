/**
 * Wongnai Merchant App (WMA) Virtual ESC/POS Printer Bridge Server
 * Listens on TCP Port 9100, captures print streams from WMA, parses LINE MAN orders,
 * inserts them into Supabase, and optionally forwards raw prints to the physical printer.
 */

import net from 'net';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { decodeAndParseWmaBuffer } from './wma-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const PORT = parseInt(process.env.WMA_BRIDGE_PORT || '9100', 10);
const HOST = process.env.WMA_BRIDGE_HOST || '0.0.0.0';
const FORWARD_PRINTER_IP = process.env.FORWARD_PRINTER_IP || null;
const FORWARD_PRINTER_PORT = parseInt(process.env.FORWARD_PRINTER_PORT || '9100', 10);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ [WMA Bridge] Missing Supabase URL or Key in environment variables.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Cache of menu items for quick ID resolution
let menuItemsCache = [];

async function refreshMenuCache() {
    try {
        const { data, error } = await supabase
            .from('menu_items')
            .select('id, name, price, category_id');
        if (!error && data) {
            menuItemsCache = data;
            console.log(`📦 [WMA Bridge] Cached ${menuItemsCache.length} menu items from database.`);
        }
    } catch (err) {
        console.warn('⚠️ [WMA Bridge] Failed to load menu items cache:', err.message);
    }
}

function findMatchingMenuItem(parsedName) {
    if (!parsedName || menuItemsCache.length === 0) return null;
    const cleanName = parsedName.toLowerCase().replace(/[\(\)\[\]]/g, '').trim();

    // 1. Exact match
    const exact = menuItemsCache.find(m => m.name.toLowerCase().trim() === cleanName);
    if (exact) return exact;

    // 2. Partial match
    const partial = menuItemsCache.find(m => {
        const dbName = m.name.toLowerCase().trim();
        return cleanName.includes(dbName) || dbName.includes(cleanName);
    });

    return partial || null;
}

// Forward raw ESC/POS stream to physical printer if enabled
function forwardPrintStream(buffer) {
    if (!FORWARD_PRINTER_IP) return;

    try {
        const client = new net.Socket();
        client.setTimeout(4000);
        client.connect(FORWARD_PRINTER_PORT, FORWARD_PRINTER_IP, () => {
            client.write(buffer, () => {
                client.end();
            });
        });
        client.on('error', (err) => {
            console.warn(`⚠️ [WMA Bridge] Print forward failed to ${FORWARD_PRINTER_IP}:${FORWARD_PRINTER_PORT}:`, err.message);
        });
    } catch (e) {
        console.warn('⚠️ [WMA Bridge] Forward exception:', e.message);
    }
}

async function handleIncomingWmaOrder(order) {
    if (!order || (!order.items || order.items.length === 0) && !order.order_id) {
        console.log('ℹ️ [WMA Bridge] Received non-order print stream (test print or summary).');
        return;
    }

    console.log(`\n========================================`);
    console.log(`🛵 [WMA Bridge] Incoming LINE MAN Order!`);
    console.log(`   Order ID: ${order.order_id}`);
    console.log(`   Customer: ${order.customer_name} (${order.customer_phone || 'No phone'})`);
    console.log(`   Rider:    ${order.rider_name || 'N/A'}`);
    console.log(`   Total:    ฿${order.total_amount}`);
    console.log(`   Items (${order.items.length}):`);
    order.items.forEach(it => {
        console.log(`     - ${it.quantity}x ${it.name} (฿${it.price || it.price_at_time})`);
        if (it.selected_options?.length > 0) {
            it.selected_options.forEach(opt => console.log(`       * ${opt.name}`));
        }
    });
    console.log(`========================================\n`);

    try {
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
            deposit_amount: order.total_amount, // Prepaid platform order
            tracking_token: `LM${order.short_id || ''}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        };

        const { data: newBooking, error: bookingErr } = await supabase
            .from('bookings')
            .insert(bookingPayload)
            .select()
            .single();

        if (bookingErr) {
            throw new Error(`Failed to insert booking: ${bookingErr.message}`);
        }

        console.log(`✅ [WMA Bridge] Booking created in Supabase with ID: ${newBooking.id} (Ref: #${order.short_id})`);

        // Insert order items
        if (order.items && order.items.length > 0) {
            const fallbackItemId = menuItemsCache[0]?.id || 1;

            const orderItemsPayload = order.items.map(item => {
                const matchedMenu = findMatchingMenuItem(item.name);
                const options = [];

                // If not matched, include custom item title banner
                if (!matchedMenu) {
                    options.push({ name: `[LINE MAN Item: ${item.name}]` });
                }

                if (item.selected_options && item.selected_options.length > 0) {
                    options.push(...item.selected_options);
                }

                if (item.special_instructions) {
                    options.push({ name: item.special_instructions });
                }

                return {
                    booking_id: newBooking.id,
                    menu_item_id: matchedMenu ? matchedMenu.id : fallbackItemId,
                    quantity: item.quantity || 1,
                    price_at_time: item.price_at_time || item.price || (matchedMenu ? matchedMenu.price : 0),
                    selected_options: options,
                    status: 'pending',
                    is_checked: false
                };
            });

            const { error: itemsErr } = await supabase
                .from('order_items')
                .insert(orderItemsPayload);

            if (itemsErr) {
                console.warn(`⚠️ [WMA Bridge] Failed to insert order items:`, itemsErr.message);
            } else {
                console.log(`✅ [WMA Bridge] Inserted ${orderItemsPayload.length} order items successfully.`);
            }
        }
    } catch (err) {
        console.error('❌ [WMA Bridge] Error saving order to Supabase:', err);
    }
}

// Create TCP Server on JetDirect / ESC/POS Raw Port 9100
const server = net.createServer((socket) => {
    const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`🔌 [WMA Bridge] Connection accepted from ${remoteAddr}`);

    const chunks = [];
    let timeoutHandle = null;

    const processBuffer = () => {
        if (chunks.length === 0) return;
        const completeBuffer = Buffer.concat(chunks);
        chunks.length = 0;

        try {
            const parsedOrder = decodeAndParseWmaBuffer(completeBuffer);
            if (parsedOrder) {
                handleIncomingWmaOrder(parsedOrder);
            }
            forwardPrintStream(completeBuffer);
        } catch (err) {
            console.error('❌ [WMA Bridge] Error parsing print buffer:', err);
        }
    };

    socket.on('data', (chunk) => {
        chunks.push(chunk);

        // Reset inactivity timer (ESC/POS stream chunk boundary)
        if (timeoutHandle) clearTimeout(timeoutHandle);
        timeoutHandle = setTimeout(() => {
            processBuffer();
        }, 500);
    });

    socket.on('end', () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        processBuffer();
        console.log(`🔌 [WMA Bridge] Connection closed by ${remoteAddr}`);
    });

    socket.on('error', (err) => {
        console.warn(`⚠️ [WMA Bridge] Socket error (${remoteAddr}):`, err.message);
    });
});

server.listen(PORT, HOST, async () => {
    console.log(`\n🚀 [WMA Bridge] Server listening on TCP ${HOST}:${PORT}`);
    console.log(`   Configure Wongnai Merchant App (WMA) -> IP Printer -> ${HOST === '0.0.0.0' ? '<YOUR-DEVICE-IP>' : HOST}:${PORT}`);
    if (FORWARD_PRINTER_IP) {
        console.log(`   🖨️ Print Forwarding Enabled -> ${FORWARD_PRINTER_IP}:${FORWARD_PRINTER_PORT}`);
    }
    await refreshMenuCache();
});

export { server, handleIncomingWmaOrder };
