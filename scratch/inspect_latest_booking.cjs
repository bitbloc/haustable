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

async function inspectLatestBookings() {
    console.log('Fetching latest 5 bookings from Supabase...');
    const { data: bookings, error } = await supabase
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
            customer_name,
            xhaus_earned,
            xhaus_redeemed,
            profiles ( id, display_name, nickname, phone_number, current_tier )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching bookings:', error);
        return;
    }

    console.log(JSON.stringify(bookings, null, 2));

    console.log('\n--- Searching for member named bam or admin bam ---');
    const { data: members, error: mErr } = await supabase
        .from('profiles')
        .select('id, display_name, nickname, phone_number')
        .or('display_name.ilike.%bam%,nickname.ilike.%bam%');

    console.log('Members matching bam:', members);
}

inspectLatestBookings();
