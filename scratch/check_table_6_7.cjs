const fs = require('fs');
const path = require('path');

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

async function check() {
    console.log('=== ALL TABLES IN tables_layout ===');
    const { data: tables } = await supabase
        .from('tables_layout')
        .select('*')
        .order('id');
    if (tables) {
        tables.forEach(t => {
            console.log(`id: ${t.id} | table_name: "${t.table_name}" | capacity: ${t.capacity} | status: ${t.status}`);
        });
    }

    console.log('\n=== BOOKINGS FOR TABLE H6 & H7 (or table_id around 3, 4, 6, 7) ===');
    const { data: bookings } = await supabase
        .from('bookings')
        .select('id, table_id, status, booking_time, booking_type, pax, staff_remark, total_amount, created_at, tables_layout(*), order_items(*, menu_items(name))')
        .gte('created_at', '2026-09-14T00:00:00')
        .order('created_at', { ascending: false });
    
    if (bookings) {
        bookings.forEach(b => {
            const tName = b.tables_layout?.table_name;
            console.log(`\nBooking ${b.id.slice(0, 8)} | Table: ${tName} (id: ${b.table_id}) | Status: ${b.status} | Type: ${b.booking_type} | Time: ${b.booking_time} | Remark: ${b.staff_remark}`);
            console.log(`Items (${(b.order_items || []).length}):`);
            (b.order_items || []).forEach(item => {
                console.log(`  - [item_id: ${item.id}] ${item.menu_items?.name || item.name} x${item.quantity} (status: ${item.status})`);
            });
        });
    }
}

check();
