import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .like('key', 'link_%');

    if (error) {
        console.error(error);
        return;
    }

    console.log("App Settings keys and values:");
    data.forEach(item => {
        console.log(`  ${item.key}: ${item.value}`);
    });
}

inspect();
