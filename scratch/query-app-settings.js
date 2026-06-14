import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('app_settings').select('key, value');
  if (error) {
    console.error('Error querying app_settings:', error);
    return;
  }
  console.log('App settings:');
  data.forEach(item => {
    const valStr = item.value ? (item.value.length > 8 ? item.value.substring(0, 8) + '...' : item.value) : '[EMPTY]';
    console.log(`- ${item.key}: ${valStr} (length: ${item.value ? item.value.length : 0})`);
  });
}

run();
