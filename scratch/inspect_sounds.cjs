const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const client = createClient(supabaseUrl, supabaseKey);
client.from('app_settings').select('*').then(({ data, error }) => {
    if (error) {
        console.error("Error fetching settings:", error);
    } else {
        console.log("Filtered App Settings (sound, alert, bill):");
        data.forEach(d => {
            const k = d.key.toLowerCase();
            if (k.includes('sound') || k.includes('alert') || k.includes('bill')) {
                console.log(`- ${d.key}: ${d.value}`);
            }
        });
    }
});
