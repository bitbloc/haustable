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

async function testGroups() {
    const { data } = await supabase.from('option_groups').select('*');
    console.log(JSON.stringify(data.map(g => ({
        name: g.name,
        is_required: g.is_required,
        selection_type: g.selection_type,
        min: g.min_selection,
        max: g.max_selection
    })), null, 2));
}
testGroups();
