const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function run() {
    console.log("Fetching profiles...");
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'staff']);

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log(`Found ${profiles.length} admin/staff profiles:`);
    profiles.forEach(p => {
        console.log(`- ID: ${p.id}, Display Name: ${p.display_name}, Role: ${p.role}`);
    });
}
run();
