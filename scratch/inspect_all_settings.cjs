require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function run() {
    console.log("Fetching all app_settings...");
    const { data, error } = await supabase
        .from('app_settings')
        .select('*');
        
    if (error) {
        console.error("Error fetching settings:", error);
        return;
    }
    console.log(data);
}

run();
