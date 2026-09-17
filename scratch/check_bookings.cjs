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

async function inspectToday() {
    const { data, error } = await supabase
        .from('bookings')
        .select('id, created_at, status, booking_type, table_id, staff_remark, pickup_contact_name, customer_note, total_amount, order_items(*)')
        .order('created_at', { ascending: false })
        .limit(10);
    if (error) {
        console.error('Error fetching bookings:', error);
        return;
    }
    console.log(JSON.stringify(data.map(b => ({
        id: b.id,
        created_at: b.created_at,
        status: b.status,
        booking_type: b.booking_type,
        table_id: b.table_id,
        items_count: b.order_items ? b.order_items.length : 0,
        items: (b.order_items || []).map(i => ({ id: i.id, menu_item_id: i.menu_item_id, qty: i.quantity, name: i.custom_name, destination: i.destination }))
    })), null, 2));
}
inspectToday();
