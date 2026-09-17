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

async function inspectBooking() {
    const { data } = await supabase
        .from('bookings')
        .select('*, order_items(*)')
        .in('id', ['1d1aa564-561e-4681-9c51-72cecf2c9201', '4ce23fbc-5976-4d37-928b-4da5fc1f07f4', '1c9ad001-902e-418e-8003-dc1d17adb616']);
    console.log(JSON.stringify(data, null, 2));
}
inspectBooking();
