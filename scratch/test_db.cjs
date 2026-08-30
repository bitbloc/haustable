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
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_KEY);

async function test() {
    console.log('Testing menu_categories query...');
    const { data: cats, error: catErr } = await supabase.from('menu_categories').select('id, name, is_drink_stamp_eligible').limit(3);
    console.log('Cats:', cats, 'Error:', catErr);

    console.log('Testing menu_items query...');
    const { data: items, error: itemErr } = await supabase.from('menu_items').select('id, name, is_drink_stamp_eligible').limit(3);
    console.log('Items:', items, 'Error:', itemErr);

    if (cats && cats.length > 0) {
        console.log('Testing update on menu_categories...');
        const targetCat = cats[0];
        const updateRes = await supabase.from('menu_categories').update({ is_drink_stamp_eligible: targetCat.is_drink_stamp_eligible }).eq('id', targetCat.id);
        console.log('Update cat result:', updateRes);
    }
}
test();
