import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixCategories() {
    console.log('--- Checking if "Steak Pre-order" category exists ---');
    const { data: existingSteakCat, error: steakError } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('name', 'Steak Pre-order')
        .maybeSingle();

    if (steakError) {
        console.error('Error fetching Steak Pre-order category:', steakError);
        return;
    }

    let steakCatId;
    if (!existingSteakCat) {
        console.log('"Steak Pre-order" category is missing. Inserting it...');
        const { data: newSteakCat, error: insertError } = await supabase
            .from('menu_categories')
            .insert({
                name: 'Steak Pre-order',
                display_order: 999
            })
            .select()
            .single();

        if (insertError) {
            console.error('Failed to insert Steak Pre-order category:', insertError);
            return;
        }
        console.log('Successfully inserted Steak Pre-order category:', newSteakCat);
        steakCatId = newSteakCat.id;
    } else {
        console.log('"Steak Pre-order" category already exists with ID:', existingSteakCat.id);
        steakCatId = existingSteakCat.id;
    }

    console.log('\n--- Fetching all categories ---');
    const { data: categories } = await supabase.from('menu_categories').select('*');
    const catMapById = {};
    const catMapByName = {};
    
    categories.forEach(c => {
        catMapById[c.id] = c.name;
        catMapByName[c.name] = c.id;
    });

    console.log('--- Fetching all menu items ---');
    const { data: items, error: itemsError } = await supabase.from('menu_items').select('*');
    if (itemsError) {
        console.error('Error fetching menu items:', itemsError);
        return;
    }

    console.log(`Processing ${items.length} items...`);
    let updateCount = 0;

    for (const item of items) {
        let targetCategoryId = item.category_id;
        let targetCategoryName = item.category;
        let needsUpdate = false;

        // Case 1: category_id is set. Let's make sure the text field "category" matches.
        if (targetCategoryId) {
            const currentCatName = catMapById[targetCategoryId];
            if (currentCatName && item.category !== currentCatName) {
                console.log(`Mismatch on "${item.name}": database has category="${item.category}", expected="${currentCatName}"`);
                targetCategoryName = currentCatName;
                needsUpdate = true;
            }
        } 
        // Case 2: category_id is null. Let's find it by category name.
        else if (item.category) {
            const currentCatId = catMapByName[item.category];
            if (currentCatId) {
                console.log(`Null category_id for "${item.name}": resolving to ID "${currentCatId}" based on name "${item.category}"`);
                targetCategoryId = currentCatId;
                needsUpdate = true;
            } else if (item.category === 'Steak Pre-order') {
                console.log(`Mapping "${item.name}" to new Steak Pre-order category ID "${steakCatId}"`);
                targetCategoryId = steakCatId;
                needsUpdate = true;
            } else {
                console.log(`Warning: Item "${item.name}" has category name "${item.category}" which matches no category in database.`);
            }
        }

        if (needsUpdate) {
            const { error: updateError } = await supabase
                .from('menu_items')
                .update({
                    category_id: targetCategoryId,
                    category: targetCategoryName
                })
                .eq('id', item.id);

            if (updateError) {
                console.error(`Failed to update item "${item.name}":`, updateError);
            } else {
                console.log(`Successfully updated item "${item.name}"`);
                updateCount++;
            }
        }
    }

    console.log(`\nCategory alignment complete. Updated ${updateCount} items.`);
}

fixCategories();
