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

async function runVerification() {
    console.log('=== VERIFICATION 1: POSReportsPanel Query ===');
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const startOfDay = `${todayStr}T00:00:00+07:00`;
    const endOfDay = `${todayStr}T23:59:59+07:00`;

    const { data: bData, error: bErr } = await supabase
        .from('bookings')
        .select(`
            *,
            profiles ( id, display_name, nickname, phone_number, current_tier ),
            tables_layout (table_name),
            order_items (
                id,
                quantity,
                price_at_time,
                selected_options,
                menu_item_id,
                menu_items (
                    name,
                    category_id
                )
            ),
            promotion_codes (code)
        `)
        .gte('booking_time', startOfDay)
        .lte('booking_time', endOfDay)
        .order('booking_time', { ascending: false });

    if (bErr) {
        console.error('FAILED - POSReportsPanel query error:', bErr);
    } else {
        console.log(`SUCCESS - POSReportsPanel query returned ${bData.length} records without error!`);
    }

    console.log('\n=== VERIFICATION 2: POSCRMPanel Query ===');
    const { data: crmData, error: crmErr } = await supabase
        .from('bookings')
        .select(`
            *,
            order_items (
                id,
                quantity,
                price_at_time,
                menu_items (name)
            )
        `)
        .limit(2);

    if (crmErr) {
        console.error('FAILED - POSCRMPanel query error:', crmErr);
    } else {
        console.log(`SUCCESS - POSCRMPanel query returned ${crmData.length} records without error!`);
    }

    console.log('\n=== VERIFICATION 3: MemberCard Query ===');
    const { data: memData, error: memErr } = await supabase
        .from('bookings')
        .select(`
            id, booking_time, status, total_amount, discount_amount, staff_remark,
            order_items (
                id, quantity, price_at_time,
                menu_items ( name )
            )
        `)
        .limit(2);

    if (memErr) {
        console.error('FAILED - MemberCard query error:', memErr);
    } else {
        console.log(`SUCCESS - MemberCard query returned ${memData.length} records without error!`);
    }

    console.log('\n=== VERIFICATION 4: process_drink_stamps RPC ===');
    const { data: stampRes, error: stampErr } = await supabase.rpc('process_drink_stamps', {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_stamp_count: 0,
        p_quota_used: 0
    });

    if (stampErr) {
        console.error('FAILED - process_drink_stamps error:', stampErr);
    } else {
        console.log('SUCCESS - process_drink_stamps returned:', stampRes);
    }
}

runVerification();
