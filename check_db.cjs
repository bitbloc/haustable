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
    console.log('Fetching latest bookings...');
    const { data: bookings } = await supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(5);
    if (bookings && bookings.length > 0) {
        console.log('Columns:', Object.keys(bookings[0]));
        console.log('Sample rows:', bookings.map(b => ({
            id: b.id,
            booking_type: b.booking_type,
            status: b.status,
            total_amount: b.total_amount,
            staff_remark: b.staff_remark,
            payment_slip_url: b.payment_slip_url,
            payment_method: b.payment_method
        })));
    }
}
check();
