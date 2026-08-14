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

async function testRPCs() {
    console.log('Testing RPCs with test user 8f3ee286-700b-4b7f-9926-ff9a51e24070 (banff line)...');
    const testUserId = '8f3ee286-700b-4b7f-9926-ff9a51e24070';
    
    // 1. Check get_member_tier_details
    const { data: tierData, error: tierErr } = await supabase.rpc('get_member_tier_details', { p_user_id: testUserId });
    console.log('1. get_member_tier_details:', tierData, tierErr);

    // 2. Check process_drink_stamps
    const { data: stampData, error: stampErr } = await supabase.rpc('process_drink_stamps', {
        p_user_id: testUserId,
        p_stamp_count: 1,
        p_quota_used: 0
    });
    console.log('2. process_drink_stamps:', stampData, stampErr);

    // 3. Check process_checkout_xhaus with an existing booking
    const { data: latestBooking } = await supabase.from('bookings').select('id').order('created_at', { ascending: false }).limit(1).single();
    if (latestBooking) {
        console.log('Testing process_checkout_xhaus with booking:', latestBooking.id);
        const { data: xData, error: xErr } = await supabase.rpc('process_checkout_xhaus', {
            p_booking_id: latestBooking.id,
            p_xhaus_earned: 5.00,
            p_xhaus_redeemed: 0.00,
            p_xhaus_discount: 0.00,
            p_user_id: testUserId
        });
        console.log('3. process_checkout_xhaus result:', xData, xErr);
    }
}

testRPCs();
