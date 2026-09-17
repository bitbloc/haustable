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

async function testQuery1928() {
    const { data: latest } = await supabase.from('bookings').select('id').limit(1);
    const bId = latest[0].id;
    const { data, error } = await supabase
        .from('bookings')
        .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, menu_categories(name, is_drink_stamp_eligible)))')
        .eq('id', bId)
        .maybeSingle();
    console.log('Query 1928 test:', { dataId: data?.id, error });
}
testQuery1928();
