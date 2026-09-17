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

async function testSelectProfiles() {
    const { data, error } = await supabase
        .from('bookings')
        .insert({
            table_id: null,
            source: 'pos',
            status: 'seated',
            booking_type: 'pickup',
            booking_time: new Date().toISOString(),
            pax: 1,
            customer_note: 'Walk-in Customer',
            pickup_contact_name: 'Walk-in Customer',
            staff_remark: 'Walk-in Pick-up',
            user_id: null
        })
        .select('*, profiles(*)')
        .single();
    console.log('Insert test with profiles(*):', { data: data?.id, error });
    if (data?.id) {
        await supabase.from('bookings').delete().eq('id', data.id);
    }
}
testSelectProfiles();
