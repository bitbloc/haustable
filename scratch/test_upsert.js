import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testUpsert() {
    console.log('--- Fetching item 74 before upsert ---');
    const { data: before } = await supabase.from('menu_items').select('*').eq('id', 74).single();
    console.log('Before:', before);

    console.log('--- Trying partial upsert ---');
    const { data, error } = await supabase.from('menu_items').upsert({
        id: 74,
        sort_order: 1,
        is_recommended: false,
        category: 'Soft Drink'
    }).select();

    if (error) {
        console.error('Upsert failed with error:', error);
    } else {
        console.log('Upsert succeeded! Returned data:', data);
        
        console.log('--- Fetching item 74 after upsert ---');
        const { data: after } = await supabase.from('menu_items').select('*').eq('id', 74).single();
        console.log('After:', after);
        
        // Restore
        await supabase.from('menu_items').update({
            category: before.category
        }).eq('id', 74);
    }
}

testUpsert();
