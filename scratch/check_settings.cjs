const fs = require('fs');
const path = require('path');

let env = {};
if (fs.existsSync('.env')) {
    env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
        if (!line || !line.includes('=')) return acc;
        const parts = line.split('=');
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/['"]+/g, '');
        if(key) acc[key] = val;
        return acc;
    }, {});
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY);

async function run() {
    const { data, error } = await supabase.from('app_settings').select('*').limit(3);
    console.log('Sample data from app_settings:', data);
    console.log('Error:', error);
}
run();
