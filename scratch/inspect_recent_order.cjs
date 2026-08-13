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

async function inspectRecentOrders() {
    console.log('Fetching bookings created in the last 30 minutes...');
    const nowIso = new Date().toISOString();
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
            pickup_contact_phone,
            xhaus_earned,
            xhaus_redeemed,
            profiles ( id, display_name, nickname, phone_number, current_tier, xhaus_balance ),
            tables_layout ( table_name )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching bookings:', error);
        return;
    }

    console.log('Latest 5 Bookings in DB:');
    bookings.forEach((b, i) => {
        console.log(`\n--- [${i+1}] ID: ${b.id} ---`);
        console.log(`Time: ${b.booking_time} (created_at: ${b.created_at})`);
        console.log(`Table: ${b.tables_layout?.table_name || 'PICK'}`);
        console.log(`Status: ${b.status}`);
        console.log(`Total: ${b.total_amount}`);
        console.log(`User ID: ${b.user_id}`);
        console.log(`Profiles:`, b.profiles);
        console.log(`xhaus_earned: ${b.xhaus_earned}, xhaus_redeemed: ${b.xhaus_redeemed}`);
        console.log(`pickup_contact_name: ${b.pickup_contact_name}`);
        console.log(`staff_remark: ${b.staff_remark}`);
    });

    console.log('\n--- Checking profile for admin bam ---');
    const { data: bamProfiles, error: bamErr } = await supabase
        .from('profiles')
        .select('*')
        .or('display_name.ilike.%bam%,nickname.ilike.%bam%');

    console.log('Bam profiles:', bamProfiles);
}

inspectRecentOrders();
