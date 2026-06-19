import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function searchItem() {
    console.log('--- Searching for all menu items containing "ไตปลา" ---');
    const { data: items, error } = await supabase
        .from('menu_items')
        .select('*');
        
    if (error) {
        console.error('Error fetching menu items:', error);
        return;
    }

    console.log(`Found total ${items.length} menu items in database.`);
    const matches = items.filter(item => item.name.includes('ไตปลา'));
    console.log(`Found ${matches.length} matching items:`);
    matches.forEach(item => {
        console.log(` - ID: ${item.id}, Name: ${item.name}, Price: ${item.price}, Available: ${item.is_available}, Rec: ${item.is_recommended}, Category: ${item.category}, CategoryID: ${item.category_id}`);
    });
}

searchItem();
