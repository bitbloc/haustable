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

async function testReportQuery() {
    const { data, error } = await supabase
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
        .eq('id', 'ce14e217-f8d6-443f-8ed2-ce1a3a019163');
        
    console.log('Error:', error);
    console.log('Data:', JSON.stringify(data, null, 2));
}

testReportQuery();
