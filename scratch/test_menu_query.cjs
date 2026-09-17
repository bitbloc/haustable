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

async function testOptions() {
    const { data } = await supabase.from('menu_items').select('id, name, menu_item_options(*, option_groups(*, option_choices(*)))').eq('is_available', true);
    const withOpts = data.filter(i => i.menu_item_options && i.menu_item_options.length > 0);
    console.log('Total items with options:', withOpts.length);
    if (withOpts.length > 0) {
        console.log('Sample item with options:', withOpts[0].name, JSON.stringify(withOpts[0].menu_item_options[0], null, 2));
    }
}
testOptions();
