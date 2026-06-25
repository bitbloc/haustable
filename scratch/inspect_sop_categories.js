import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectSopCategories() {
    const r1 = await supabase.from('sop_categories').select('*');
    const r2 = await supabase.from('sop_recipes').select('id, name, category_id');
    
    if (r1.error) console.error('SOP Categories Error:', r1.error);
    if (r2.error) console.error('SOP Recipes Error:', r2.error);
        
    const categories = r1.data || [];
    const recipes = r2.data || [];
    
    console.log(`Found ${categories.length} SOP categories:`);
    categories.forEach(c => {
        console.log(` - ID: ${c.id}, Label: ${c.label}, Icon: ${c.icon}`);
    });

    console.log(`\nFound ${recipes.length} SOP recipes:`);
    recipes.forEach(r => {
        console.log(` - ID: ${r.id}, Name: ${r.name}, Category ID: ${r.category_id}`);
    });
}

inspectSopCategories();
