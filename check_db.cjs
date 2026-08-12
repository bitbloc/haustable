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
    const { data: bookings } = await supabase.from('bookings').select('id, user_id, status, total_amount').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(bookings, null, 2));
}
check();
