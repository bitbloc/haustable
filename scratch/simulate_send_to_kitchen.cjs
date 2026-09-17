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

async function simulate() {
    console.log('--- 1. Testing Open Table Flow ---');
    // Staff opens table 6
    const { data: newBooking, error: bErr } = await supabase
        .from('bookings')
        .insert({
            table_id: 6,
            status: 'seated',
            booking_type: 'walk_in',
            booking_time: new Date().toISOString(),
            pax: 2,
            staff_remark: 'Walk-in Guest'
        })
        .select('*, tables_layout(*), profiles(*)')
        .single();
    
    if (bErr) {
        console.error('Error creating walk-in booking:', bErr);
        return;
    }
    console.log('Created booking:', newBooking.id);

    // Staff adds items to cart
    const { data: menuItems } = await supabase.from('menu_items').select('*').limit(2);
    console.log('Menu items fetched:', menuItems.map(m => ({ id: m.id, name: m.name })));

    const currentOrder = {
        items: [
            {
                id: `draft_${Date.now()}_1`,
                menu_item_id: menuItems[0].id,
                name: menuItems[0].name,
                custom_name: null,
                price: menuItems[0].price,
                quantity: 1,
                selected_options: [],
                item_note: '',
                category_id: menuItems[0].category_id,
                destination: 'kitchen',
                is_custom: false
            }
        ]
    };

    // Now simulate handleSaveAndOpenSlip('kitchen')
    const type = 'kitchen';
    let bookingId = newBooking.id;
    let currentBooking = newBooking;

    const newItems = currentOrder.items.filter(i => !i.db_id);
    console.log('newItems count:', newItems.length);

    // submitOrderItems logic
    const resolveMenuItemId = (item) => {
        if (item.menu_item_id && typeof item.menu_item_id !== 'string') return item.menu_item_id;
        if (item.menu_item_id && typeof item.menu_item_id === 'string' && !item.menu_item_id.startsWith('reward-') && !item.menu_item_id.startsWith('local_') && !item.menu_item_id.startsWith('custom_')) return item.menu_item_id;
        if (item.id && typeof item.id !== 'string') return item.id;
        if (item.id && typeof item.id === 'string' && !item.id.startsWith('reward-') && !item.id.startsWith('local_') && !item.id.startsWith('custom_')) return item.id;
        return null;
    };

    const itemsToInsert = newItems.map(item => {
        const finalOpts = [...(item.selected_options || [])];
        if (item.item_note) {
            finalOpts.push({ name: `Note: ${item.item_note}` });
        }
        const isCustom = Boolean(item.is_custom === true || item.is_emergency === true || String(item.id).startsWith('custom_'));
        const customName = item.custom_name || item.name || null;
        return {
            booking_id: bookingId,
            menu_item_id: resolveMenuItemId(item),
            quantity: item.quantity,
            price_at_time: item.price,
            selected_options: finalOpts,
            custom_name: isCustom ? customName : null,
            is_custom: isCustom,
            destination: item.destination || 'kitchen'
        };
    });

    console.log('itemsToInsert:', JSON.stringify(itemsToInsert, null, 2));

    const { data: insertedData, error: insErr } = await supabase
        .from('order_items')
        .insert(itemsToInsert)
        .select('*, menu_items(name, category_id, menu_categories(name))');
    
    console.log('Inserted order_items:', { insertedData, insErr });

    // Clean up
    await supabase.from('order_items').delete().eq('booking_id', bookingId);
    await supabase.from('bookings').delete().eq('id', bookingId);
    console.log('Cleaned up.');
}
simulate();
