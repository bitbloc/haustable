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

async function fixA2eb() {
    const billId = '75afd293-eae7-4acb-ad62-5c9a7e91ffd2';
    const bamId = '6bb9cc68-7998-4c6a-90dc-c50dbc45ac67';

    console.log('1. Updating bill with Admin Bam user_id...');
    const { data: bData, error: bErr } = await supabase
        .from('bookings')
        .update({
            user_id: bamId,
            pickup_contact_name: 'Admin Bam',
            pickup_contact_phone: '0961424663'
        })
        .eq('id', billId)
        .select('*, profiles(*)');

    console.log('Bill update:', bData, bErr);

    console.log('2. Processing xhaus checkout for Admin Bam...');
    const { data: xData, error: xErr } = await supabase.rpc('process_checkout_xhaus', {
        p_booking_id: billId,
        p_xhaus_earned: 2.19,
        p_xhaus_redeemed: 0.00,
        p_xhaus_discount: 0.00,
        p_user_id: bamId
    });
    console.log('xhaus result:', xData, xErr);

    console.log('3. Processing drink stamp (+1 for Espresso shot)...');
    const { data: sData, error: sErr } = await supabase.rpc('process_drink_stamps', {
        p_user_id: bamId,
        p_stamp_count: 1,
        p_quota_used: 0
    });
    console.log('stamp result:', sData, sErr);

    console.log('4. Verifying Admin Bam profile...');
    const { data: pData } = await supabase.from('profiles').select('*').eq('id', bamId).single();
    console.log('Admin Bam updated profile:', pData);
}

fixA2eb();
