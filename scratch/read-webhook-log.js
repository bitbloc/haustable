import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('app_settings')
    .select('*')
    .eq('key', 'webhook_debug_log')
    .single();
    
  if (error) {
    console.error("Error or no logs:", error);
    return;
  }
  
  try {
    const logVal = JSON.parse(data.value);
    console.log("=== LATEST WEBHOOK LOG ===");
    console.log("Time:", logVal.time);
    console.log("Step:", logVal.step);
    console.log("Data:", JSON.stringify(logVal.data, null, 2));
  } catch (e) {
    console.log("Raw log value:", data.value);
  }
}

run();
