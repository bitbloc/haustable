import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSettings() {
    console.log('Fetching app_settings...');
    const { data, error } = await supabase
        .from('app_settings')
        .select('*');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Settings found:', data.length);
        data.forEach(row => {
            console.log(`- ${row.key}: ${row.value}`);
        });
    }
}

checkSettings();
