const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const client = createClient(supabaseUrl, supabaseKey);

client.from('profiles').select('points').limit(1).then(({ data, error }) => {
    if (error) {
        console.log("Status: COLUMN_MISSING");
        console.log("Error details:", error.message);
    } else {
        console.log("Status: COLUMN_EXISTS");
        console.log("Data:", data);
    }
});
