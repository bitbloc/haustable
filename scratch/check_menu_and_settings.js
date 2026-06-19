import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSettingsAndMenu() {
    console.log('--- Fetching app_settings (key LIKE link_%) ---');
    const { data: settings, error: sErr } = await supabase
        .from('app_settings')
        .select('*')
        .like('key', 'link_%');

    if (sErr) {
        console.error('Settings error:', sErr);
    } else {
        console.log(`Found ${settings.length} settings:`);
        settings.forEach(s => {
            console.log(` - ${s.key}: ${s.value}`);
        });
    }

    console.log('\n--- Fetching menu_items (is_available=true) ---');
    const { data: items, error: iErr } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_available', true);

    if (iErr) {
        console.error('Items error:', iErr);
    } else {
        console.log(`Found ${items.length} menu items:`);
        items.forEach((item, index) => {
            console.log(` - [${index + 1}] ID: ${item.id}, Name: ${item.name}, Price: ${item.price}, Rec: ${item.is_recommended}, Order: ${item.sort_order ?? item.display_order}`);
        });
    }
}

checkSettingsAndMenu();
