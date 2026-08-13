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

async function testRpc() {
    console.log('Testing get_member_service_history RPC with zero UUID...');
    const testId = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await supabase.rpc('get_member_service_history', { p_user_id: testId });
    console.log('RPC Error:', error);
    console.log('RPC Result count:', data ? data.length : null);
}

testRpc();
