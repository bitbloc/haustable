const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
    const { data, error } = await supabase.from('profiles').select('*').limit(5);
    console.log('Error:', error);
    if (data && data.length > 0) {
        console.log('Sample profile keys:', Object.keys(data[0]));
        console.log('Sample profile 0:', data[0]);
    } else {
        console.log('No profiles found or data is empty');
    }
}

checkProfiles();
