const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    if (!line || !line.includes('=')) return acc;
    const parts = line.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/['"]+/g, '');
    if(key) acc[key] = val;
    return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY);
async function run() {
    const { data, error } = await supabase.from('app_settings').select('*');
    if (data) {
        console.log('App settings keys:', data.map(s => ({ key: s.key, value: String(s.value).slice(0, 50) })));
    }
}
run();
