import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectCategories() {
    const { data: categories, error } = await supabase
        .from('menu_categories')
        .select('*')
        .order('display_order');
        
    if (error) {
        console.error('Error fetching categories:', error);
        return;
    }

    console.log(`Found ${categories.length} categories:`);
    categories.forEach(c => {
        console.log(` - ID: ${c.id}, Name: ${c.name}, Display Order: ${c.display_order}`);
    });
}

inspectCategories();
