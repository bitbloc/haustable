import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function analyzePickupDiscrepancy() {
    const [{ data: categories }, { data: menuItems }] = await Promise.all([
        supabase.from('menu_categories').select('*').order('display_order'),
        supabase.from('menu_items').select('*, menu_categories(id, name)').order('name')
    ]);

    console.log('=== CATEGORIES IN DB ===');
    categories.forEach(c => {
        console.log(`[Cat ID: ${c.id}] "${c.name}" (display_order: ${c.display_order}, is_hidden: ${c.is_hidden})`);
    });

    console.log('\n=== PICKUP PAGE SIMULATION ===');
    // How PickupPage.jsx does it:
    // 1. setMenuItems(allMenuItems.filter(item => item.is_pickup_available !== false))
    const pickupItems = menuItems.filter(item => item.is_pickup_available !== false);
    const pickupExcluded = menuItems.filter(item => item.is_pickup_available === false);

    console.log(`Total DB items: ${menuItems.length}`);
    console.log(`Included in PickupPage (is_pickup_available !== false): ${pickupItems.length}`);
    console.log(`Excluded from PickupPage (is_pickup_available === false): ${pickupExcluded.length}`);

    console.log('\n--- Excluded items list ---');
    pickupExcluded.forEach(i => {
        console.log(`- [ID ${i.id}] "${i.name}" | category: "${i.category}" | cat_id: ${i.category_id} | is_available: ${i.is_available}`);
    });

    console.log('\n=== CATEGORY MATCHING ANALYSIS ===');
    // Check if each category tab in PickupPage shows all its items or if items get orphaned
    for (const cat of categories) {
        const catName = cat.name;
        // In PickupPage:
        // matchesCategory = activeCategory === 'All' ? true : (item.category === activeCategory || item.category_id === categories.find(c => c.name === activeCategory)?.id)
        const matchingPickupItems = pickupItems.filter(item => 
            item.category === catName || item.category_id === cat.id
        );
        const allMatchingDbItems = menuItems.filter(item =>
            item.category === catName || item.category_id === cat.id
        );
        console.log(`Category "${catName}": DB has ${allMatchingDbItems.length} items, Pickup shows ${matchingPickupItems.length} items`);
        if (allMatchingDbItems.length > 0 && matchingPickupItems.length === 0) {
            console.log(`  >>> EMPTY IN PICKUP! DB items:`, allMatchingDbItems.map(i => `${i.name} (pickup_avail: ${i.is_pickup_available})`));
        } else if (allMatchingDbItems.length !== matchingPickupItems.length) {
            const missing = allMatchingDbItems.filter(i => !matchingPickupItems.includes(i));
            console.log(`  >>> Some items missing in Pickup:`, missing.map(i => `${i.name} (pickup_avail: ${i.is_pickup_available})`));
        }
    }

    console.log('\n=== ITEMS WITH NO MATCHING CATEGORY IN MENU_CATEGORIES ===');
    const orphanedDbItems = menuItems.filter(item => {
        const hasCatIdMatch = categories.some(c => c.id === item.category_id);
        const hasCatNameMatch = categories.some(c => c.name === item.category);
        return !hasCatIdMatch && !hasCatNameMatch;
    });
    console.log(`Orphaned items (Total ${orphanedDbItems.length}):`);
    orphanedDbItems.forEach(i => {
        console.log(`- [ID ${i.id}] "${i.name}" | category: "${i.category}" | category_id: ${i.category_id}`);
    });

    console.log('\n=== ITEMS WITH MISMATCHED category STRING VS category_id ===');
    const mismatchedItems = menuItems.filter(item => {
        const catById = categories.find(c => c.id === item.category_id);
        if (catById && catById.name !== item.category) {
            return true;
        }
        return false;
    });
    console.log(`Mismatched items (Total ${mismatchedItems.length}):`);
    mismatchedItems.forEach(i => {
        const catById = categories.find(c => c.id === i.category_id);
        console.log(`- [ID ${i.id}] "${i.name}" | category field: "${i.category}" | category_id resolves to: "${catById?.name}"`);
    });
}

analyzePickupDiscrepancy();
