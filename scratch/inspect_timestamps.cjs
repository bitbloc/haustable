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
    const { data: b6 } = await supabase.from('bookings').select('*').eq('id', 'f2580ba1-c707-4113-8053-69388c7b1b9a').single();
    const { data: b7 } = await supabase.from('bookings').select('*').eq('id', '64624c0f-465a-4e83-aed7-0ea56f1e26c6').single();
    console.log('Booking H6:', { id: b6.id, status: b6.status, updated_at: b6.updated_at, remark: b6.staff_remark });
    console.log('Booking H7:', { id: b7.id, status: b7.status, updated_at: b7.updated_at, remark: b7.staff_remark });
    
    // Check order_items created_at
    const { data: items } = await supabase.from('order_items').select('id, booking_id, menu_item_id, quantity, created_at, status, menu_items(name)').in('booking_id', [b6.id, b7.id]).order('created_at', { ascending: true });
    console.log('Order items for both bookings:');
    items.forEach(i => {
        console.log(`- ${i.created_at} | Booking: ${i.booking_id === b6.id ? 'H6' : 'H7'} | ${i.menu_items?.name} x${i.quantity}`);
    });
}

inspect();
