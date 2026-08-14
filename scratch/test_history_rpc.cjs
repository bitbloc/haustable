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

async function testHistoryRPC() {
    const bamId = '6bb9cc68-7998-4c6a-90dc-c50dbc45ac67';
    const { data, error } = await supabase.rpc('get_member_service_history', { p_user_id: bamId });
    console.log('get_member_service_history result:');
    console.log(JSON.stringify(data, null, 2), error);
}

testHistoryRPC();
