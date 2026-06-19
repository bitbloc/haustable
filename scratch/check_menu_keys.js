import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMenuKeys() {
    const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .like('key', 'link_menu%');

    if (error) {
        console.error(error);
    } else {
        console.log('link_menu settings:');
        data.sort((a,b) => a.key.localeCompare(b.key)).forEach(s => {
            console.log(`${s.key}: ${s.value}`);
        });
    }
}

checkMenuKeys();
