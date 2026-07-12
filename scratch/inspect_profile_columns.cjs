const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const client = createClient(supabaseUrl, supabaseKey);
client.from('profiles').select('*').limit(1).then(({ data, error }) => {
    if (error) {
        console.error("Error fetching profile columns:", error);
    } else {
        console.log("Profile columns found:");
        if (data && data.length > 0) {
            console.log(JSON.stringify(Object.keys(data[0]), null, 2));
            console.log("Sample profile data:", JSON.stringify(data[0], null, 2));
        } else {
            console.log("No profile records found to inspect.");
        }
    }
});
