const fs = require('fs');
let env = {};
const envFile = fs.existsSync('.env.local') ? '.env.local' : (fs.existsSync('.env') ? '.env' : null);
if (envFile) {
    env = fs.readFileSync(envFile, 'utf8').split('\n').reduce((acc, line) => {
        if (!line || !line.includes('=')) return acc;
        const parts = line.split('=');
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/['"]+/g, '');
        if (key) acc[key] = val;
        return acc;
    }, {});
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
    const { data: items } = await supabase
        .from('order_items')
        .select('id, booking_id, menu_item_id, quantity, created_at, status, menu_items(name), bookings(id, table_id, staff_remark, tables_layout(id, table_name))')
        .gte('created_at', '2026-09-14T12:40:00')
        .order('created_at', { ascending: true });

    items.forEach(i => {
        console.log(`${i.created_at} | item #${i.id} | Booking: ${i.bookings?.id.slice(0, 8)} | Table: ${i.bookings?.tables_layout?.table_name} (table_id: ${i.bookings?.table_id}) | ${i.menu_items?.name}`);
    });
}

inspect();
