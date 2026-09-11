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

async function runAudit() {
    console.log('=== 1. ARCADE SCORING SYSTEM AUDIT ===');
    // A. Leaderboard rows
    const { data: lb, error: lbErr } = await supabase
        .from('leaderboard')
        .select('*')
        .order('score', { ascending: false });
    console.log('Leaderboard Count:', lb?.length, 'Error:', lbErr?.message || 'none');
    console.log('Top rows:', lb);

    // B. Arcade rewards log
    const { data: arcLogs, error: arcErr } = await supabase
        .from('arcade_rewards_log')
        .select('*')
        .limit(5);
    console.log('Arcade rewards log sample count:', arcLogs?.length, 'Error:', arcErr?.message || 'none');

    console.log('\n=== 2. CRM & MEMBER POINTS AUDIT ===');
    // A. Profiles with highest xhaus balance
    const { data: topPoints, error: tpErr } = await supabase
        .from('profiles')
        .select('id, display_name, nickname, xhaus_balance, current_tier, drink_stamp_count, free_drink_quota')
        .order('xhaus_balance', { ascending: false })
        .limit(5);
    console.log('Top points profiles:', topPoints);

    // B. App Settings related to CRM & points
    const { data: settings, error: stErr } = await supabase
        .from('app_settings')
        .select('key, value')
        .like('key', '%crm%');
    console.log('CRM Settings in DB:', settings);

    // C. Verify recent bookings with xhaus_earned
    const { data: recentBookings, error: rbErr } = await supabase
        .from('bookings')
        .select('id, total_amount, xhaus_earned, xhaus_redeemed, user_id, status, created_at')
        .gt('xhaus_earned', 0)
        .order('created_at', { ascending: false })
        .limit(5);
    console.log('Recent bookings with xhaus_earned > 0:', recentBookings);

    // D. Verify beverage menu items drink stamp eligibility
    const { count: stampCount, error: scErr } = await supabase
        .from('menu_items')
        .select('*', { count: 'exact', head: true })
        .eq('is_drink_stamp_eligible', true);
    console.log('Total Drink-stamp eligible menu items:', stampCount);
}

runAudit();
