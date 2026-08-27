import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectFalseItems() {
    const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_pickup_available', false)
        .order('id');

    console.log(`Found ${items.length} items with is_pickup_available = false:`);
    items.forEach(i => {
        console.log(`[ID ${i.id}] "${i.name}" | Price: ${i.price} | Category: "${i.category}" | CatID: ${i.category_id} | is_available: ${i.is_available}`);
    });
}

inspectFalseItems();
