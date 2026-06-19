import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSettings() {
    const { data: settings, error } = await supabase
        .from('app_settings')
        .select('*')
        .like('key', 'link_%');

    if (error) {
        console.error('Settings error:', error);
    } else {
        console.log(`Found ${settings.length} settings:`);
        settings.forEach(s => {
            console.log(`${s.key}: ${s.value}`);
        });
    }
}

checkSettings();
