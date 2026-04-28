import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: settingsData } = await supabase.from('app_settings').select('*');
  const appSettings = settingsData?.reduce((acc, curr) => {
    acc[curr.setting_key] = curr.setting_value
    return acc
  }, {}) || {};

  console.log("SECRET:", appSettings.line_channel_secret ? 'EXISTS' : 'MISSING');
  console.log("TOKEN:", appSettings.line_channel_access_token ? 'EXISTS' : 'MISSING');
}

run();
