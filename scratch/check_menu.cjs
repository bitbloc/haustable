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
async function run() {
    const { data, error } = await supabase.from('menu_items').select('*').ilike('name', '%NAGA%');
    console.log('Naga items:', JSON.stringify(data, null, 2));
    const { data: allHaus } = await supabase.from('menu_items').select('id, name, description, tags, origin, tasting_notes, craft_specs, is_hausmade, sub_category').eq('is_hausmade', true);
    console.log('All hausmade items:', JSON.stringify(allHaus, null, 2));
}
run();
