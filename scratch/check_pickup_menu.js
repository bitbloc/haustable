import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data: menuItems, error: menuError } = await supabase
        .from('menu_items')
        .select('*');
        
    if (menuError) {
        console.error('menuError:', menuError);
        return;
    }
    
    console.log(`Total menu items: ${menuItems.length}`);
    if (menuItems.length > 0) {
        console.log('Sample item keys:', Object.keys(menuItems[0]));
    }

    const hausmadeItems = menuItems.filter(item => 
        (item.name && item.name.toLowerCase().includes('hausmade')) ||
        (item.category && item.category.toLowerCase().includes('hausmade')) ||
        item.category_id === 'e61d0015-fec6-4389-afbb-cde205200581'
    );
    console.log('\nHausmade matching items:', hausmadeItems.map(i => ({
        id: i.id,
        name: i.name,
        category: i.category,
        category_id: i.category_id,
        is_available: i.is_available,
        is_pickup_available: i.is_pickup_available,
        is_active: i.is_active,
        is_hidden: i.is_hidden
    })));

    const categoriesWithCounts = {};
    menuItems.forEach(i => {
        const cat = i.category || 'NO_CATEGORY';
        categoriesWithCounts[cat] = (categoriesWithCounts[cat] || 0) + 1;
    });
    console.log('\nMenu item counts by string category:', categoriesWithCounts);

    const pickupFalseItems = menuItems.filter(item => item.is_pickup_available === false);
    console.log(`\nItems with is_pickup_available === false (Total: ${pickupFalseItems.length}):`);
    pickupFalseItems.forEach(i => console.log(` - ${i.name} (cat: ${i.category}, is_pickup_available: ${i.is_pickup_available})`));

    const isAvailableFalseItems = menuItems.filter(item => item.is_available === false);
    console.log(`\nItems with is_available === false (Total: ${isAvailableFalseItems.length}):`);
    isAvailableFalseItems.forEach(i => console.log(` - ${i.name} (cat: ${i.category}, is_available: ${i.is_available})`));
}

check();
