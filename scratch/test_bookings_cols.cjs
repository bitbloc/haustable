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

async function checkBookingsColumns() {
    const { data, error } = await supabase.from('bookings').select('*').limit(1);
    console.log('Bookings columns:', Object.keys(data[0] || {}));
    
    // Now test inserting into bookings with source: 'pos'
    const { data: insData, error: insErr } = await supabase.from('bookings').insert({
        table_id: null,
        source: 'pos',
        status: 'seated',
        booking_type: 'pickup',
        booking_time: new Date().toISOString(),
        pax: 1,
        customer_note: 'TEST',
        pickup_contact_name: 'TEST',
        staff_remark: 'Walk-in Pick-up'
    }).select();
    console.log('Insert test with source:', { insData, insErr });
    if (insData && insData[0]) {
        await supabase.from('bookings').delete().eq('id', insData[0].id);
    }
}
checkBookingsColumns();
