const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    if (!line || !line.includes('=')) return acc;
    const parts = line.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/['"]+/g, '');
    if(key) acc[key] = val;
    return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY);

function testPOSBillDetailsLogic(booking) {
    console.log('\n--- Testing Booking ID:', booking.id, '---');
    try {
        const shortId = booking.id ? booking.id.substring(0, 4).toUpperCase() : 'UNKNOWN';
        const bookingTimeStr = booking.booking_time ? new Date(booking.booking_time).toLocaleString('th-TH') : '-';
        const profileObj = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles;
        const tableObj = Array.isArray(booking.tables_layout) ? booking.tables_layout[0] : booking.tables_layout;
        const tableName = tableObj?.table_name || 'PICK';

        console.log('shortId:', shortId, 'bookingTime:', bookingTimeStr, 'profile:', profileObj?.display_name, 'tableName:', tableName);

        // Test Profile Details
        if (profileObj) {
            const name = profileObj.display_name || profileObj.nickname || 'สมาชิก';
            const phone = profileObj.phone_number;
            const tier = profileObj.current_tier;
            const earned = Number(booking.xhaus_earned || 0);
            const redeemed = Number(booking.xhaus_redeemed || 0);
            const disc = Number(booking.xhaus_discount || 0);
            console.log('Profile evaluated:', { name, phone, tier, earned, redeemed, disc });
        } else {
            const guest = booking.pickup_contact_name || booking.customer_name || 'ลูกค้าทั่วไป (Walk-in)';
            console.log('Guest evaluated:', guest);
        }

        // Test Order items
        const orderItems = Array.isArray(booking.order_items) ? booking.order_items : [];
        console.log('Order items count:', orderItems.length);
        orderItems.forEach((item, idx) => {
            if (!item) return;
            const menuItemObj = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
            const itemName = item.item_name || item.name || menuItemObj?.name || 'รายการสินค้า';
            const itemPrice = Number(item.price_at_time || item.price || menuItemObj?.price || 0);
            const rawOpts = item.selected_options;
            let opts = [];
            if (Array.isArray(rawOpts)) {
                opts = rawOpts;
            } else if (typeof rawOpts === 'string') {
                try {
                    const parsed = JSON.parse(rawOpts);
                    opts = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? Object.values(parsed) : [rawOpts]);
                } catch (e) {
                    opts = rawOpts ? [rawOpts] : [];
                }
            } else if (rawOpts && typeof rawOpts === 'object') {
                opts = Object.values(rawOpts);
            }

            opts.forEach((opt, oIdx) => {
                let optText = '';
                if (typeof opt === 'string' || typeof opt === 'number') {
                    optText = String(opt);
                } else if (opt && typeof opt === 'object') {
                    optText = opt.name || opt.label || opt.choice_name || opt.value || '';
                }
                // Check if optText is valid
            });

            const totalItem = itemPrice * (item.quantity || 1);
            console.log(`  Item ${idx + 1}: ${itemName} x${item.quantity || 1} = ${totalItem}`);
        });

        // Test Summary
        const subtotal = ((Number(booking.total_amount) || 0) + (Number(booking.discount_amount) || 0) + (Number(booking.xhaus_discount) || 0)).toLocaleString();
        const net = (Number(booking.total_amount) || 0).toLocaleString();
        console.log('Summary evaluated subtotal:', subtotal, 'net:', net);
        console.log('SUCCESS for booking', booking.id);
    } catch (err) {
        console.error('CRASH ON BOOKING', booking.id, err);
    }
}

async function runTest() {
    const { data: bookings } = await supabase
        .from('bookings')
        .select(`
            *,
            profiles ( id, display_name, nickname, phone_number, current_tier ),
            tables_layout (table_name),
            order_items (
                id,
                quantity,
                price_at_time,
                selected_options,
                menu_item_id,
                menu_items (
                    name,
                    category_id
                )
            ),
            promotion_codes (code)
        `)
        .order('booking_time', { ascending: false })
        .limit(20);

    for (const b of bookings) {
        testPOSBillDetailsLogic(b);
    }
}

runTest();
