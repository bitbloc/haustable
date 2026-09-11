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

async function check() {
    const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('score', { ascending: false });
    console.log('Error:', error);
    console.log('Total leaderboard rows:', data?.length);
    console.log('Rows:', JSON.stringify(data, null, 2));

    // Also check arcade_rewards_log or any other game table
    const { data: logs, error: logsError } = await supabase
        .from('arcade_rewards_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);
    console.log('Logs error:', logsError);
    console.log('Recent arcade_rewards_log:', logs?.length, JSON.stringify(logs, null, 2));
}
check();
