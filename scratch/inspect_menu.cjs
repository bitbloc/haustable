const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function inspect() {
    const { data, error } = await supabase.from('menu_items').select('id, name, price').limit(20);
    console.log('Sample menu items in DB:');
    console.log(data);
}

inspect();
