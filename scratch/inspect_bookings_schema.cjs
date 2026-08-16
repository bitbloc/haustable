const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function inspect() {
    const { data, error } = await supabase.from('order_items').select().limit(1);
    if (data && data[0]) {
        console.log('Order Items columns:', Object.keys(data[0]));
    }
}

inspect();
