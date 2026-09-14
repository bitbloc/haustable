const fs = require('fs');
const path = require('path');

let env = {};
const envFile = fs.existsSync('.env.local') ? '.env.local' : (fs.existsSync('.env') ? '.env' : null);
if (envFile) {
    env = fs.readFileSync(envFile, 'utf8').split('\n').reduce((acc, line) => {
        if (!line || !line.includes('=')) return acc;
        const parts = line.split('=');
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/['"]+/g, '');
        if (key) acc[key] = val;
        return acc;
    }, {});
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: tables } = await supabase
        .from('tables_layout')
        .select('*')
        .order('id');
    console.log(JSON.stringify(tables, null, 2));

    const { data: recent } = await supabase
        .from('bookings')
        .select('id, table_id, status, booking_time, booking_type, pax, staff_remark, total_amount, created_at, tables_layout(*)')
        .gte('created_at', '2026-09-14T12:00:00')
        .order('created_at', { ascending: false });
    console.log('\nBookings after 12:00:');
    console.log(JSON.stringify(recent, null, 2));
}

check();
