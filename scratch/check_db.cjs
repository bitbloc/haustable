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

async function check() {
    const { data: b, error } = await supabase
        .from('bookings')
        .select(`
            id, 
            user_id, 
            status, 
            total_amount, 
            xhaus_earned, 
            xhaus_redeemed, 
            created_at, 
            booking_time, 
            staff_remark, 
            booking_type,
            table_id,
            profiles(id, display_name, nickname, phone_number, current_tier, xhaus_balance, drink_stamp_count),
            order_items(id, quantity, price_at_time, menu_item_id, selected_options, menu_items(id, name, is_drink_stamp_eligible))
        `)
        .order('created_at', { ascending: false })
        .limit(10);
    console.log('Error:', error);
    console.log('Recent bookings count:', b?.length);
    console.log('Recent bookings:', JSON.stringify(b, null, 2));
}
check();
