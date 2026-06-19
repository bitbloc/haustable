import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkInconsistencies() {
    console.log('--- Fetching all categories ---');
    const { data: categories } = await supabase.from('menu_categories').select('*');
    const catMap = (categories || []).reduce((acc, c) => {
        acc[c.id] = c.name;
        return acc;
    }, {});
    
    console.log('--- Fetching all menu items ---');
    const { data: items } = await supabase.from('menu_items').select('*');
    
    if (!items) {
        console.error('No items found');
        return;
    }

    console.log('\n--- 1. Items with NULL category_id ---');
    const nullCats = items.filter(it => !it.category_id);
    console.log(`Found ${nullCats.length} items with null category_id:`);
    nullCats.forEach(it => {
        console.log(` - ID: ${it.id}, Name: ${it.name}, Category string in DB: "${it.category}"`);
    });

    console.log('\n--- 2. Items with Category Name Mismatch (item.category !== category.name) ---');
    const mismatches = items.filter(it => {
        if (!it.category_id) return false;
        const expectedName = catMap[it.category_id];
        return it.category !== expectedName;
    });
    console.log(`Found ${mismatches.length} mismatched items:`);
    mismatches.forEach(it => {
        console.log(` - ID: ${it.id}, Name: ${it.name}, Category ID: ${it.category_id}, category string: "${it.category}", expected (by ID): "${catMap[it.category_id]}"`);
    });
}

checkInconsistencies();
