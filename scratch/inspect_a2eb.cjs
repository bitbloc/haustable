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

async function inspectLatestBill() {
    const { data: b, error } = await supabase
        .from('bookings')
        .select(`
            id,
            booking_time,
            created_at,
            status,
            user_id,
            total_amount,
            staff_remark,
            pickup_contact_name,
            pickup_contact_phone,
            xhaus_earned,
            xhaus_redeemed,
            profiles ( id, display_name, nickname, phone_number, current_tier, xhaus_balance, drink_stamp_count ),
            order_items ( id, quantity, price_at_time, menu_item_id, menu_items(id, name, is_drink_stamp_eligible) )
        `)
        .order('created_at', { ascending: false })
        .limit(3);

    console.log('Latest bills in DB:');
    console.log(JSON.stringify(b, null, 2));
}

inspectLatestBill();
