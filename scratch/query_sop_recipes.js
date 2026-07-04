import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function querySettings() {
    console.log('Querying app_settings...');
    const { data: appData, error: appError } = await supabase
        .from('app_settings')
        .select('*')

    if (appError) {
        console.error('Error app_settings:', appError);
    } else {
        console.log('Found', appData.length, 'settings:');
        appData.forEach(s => {
            console.log(`- [${s.key}]: ${String(s.value).substring(0, 100)}`);
        });
    }

    console.log('\nQuerying store_settings...');
    const { data: storeData, error: storeError } = await supabase
        .from('store_settings')
        .select('*')

    if (storeError) {
        console.error('Error store_settings:', storeError);
    } else {
        console.log('Found', storeData.length, 'settings:');
        storeData.forEach(s => {
            console.log(`- [${s.key}]: ${String(s.value).substring(0, 100)}`);
        });
    }
}

querySettings();
