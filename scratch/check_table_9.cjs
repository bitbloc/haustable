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
    console.log('--- BOOKING bd911438 FULL ---');
    const { data: bDetail } = await supabase
        .from('bookings')
        .select('*, order_items(*)')
        .eq('id', 'bd911438-a6ec-4503-917e-4d6b1aeab4cd')
        .single();
    console.log(JSON.stringify(bDetail, null, 2));
    return;

    console.log('--- TABLES INFO ---');
    const { data: tables } = await supabase
        .from('tables_layout')
        .select('*')
        .order('id');
    if (tables) {
        tables.forEach(t => {
            console.log(`id: ${t.id} | table_name: "${t.table_name}" | table_number: "${t.table_number}" | status: ${t.status}`);
        });
    }

    console.log('--- BOOKING 2829e26d ---');
    const { data: b } = await supabase
        .from('bookings')
        .select('*, order_items(*)')
        .eq('id', '2829e26d-bcb2-4c34-9104-43536cf80e25')
        .single();
    console.log(b);
}

check();
