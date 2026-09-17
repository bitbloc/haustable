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

async function testInsert() {
    const bookingId = '1d1aa564-561e-4681-9c51-72cecf2c9201';
    const testItems = [
        {
            booking_id: bookingId,
            menu_item_id: 55,
            quantity: 1,
            price_at_time: 75,
            selected_options: [{ name: 'Test Option' }],
            custom_name: null,
            is_custom: false,
            destination: 'bar'
        },
        {
            booking_id: bookingId,
            menu_item_id: null,
            quantity: 1,
            price_at_time: 50,
            selected_options: [],
            custom_name: 'Custom Test Item',
            is_custom: true,
            destination: 'kitchen'
        }
    ];

    const { data, error } = await supabase
        .from('order_items')
        .insert(testItems)
        .select('*, menu_items(name, category_id, menu_categories(name))');

    console.log('Insert error:', error);
    console.log('Insert data count:', data ? data.length : 0);
    if (data) {
        console.log('Sample inserted row:', JSON.stringify(data[0], null, 2));
        // Clean up test rows
        const ids = data.map(d => d.id);
        await supabase.from('order_items').delete().in('id', ids);
        console.log('Cleaned up test items successfully');
    }
}
testInsert();
