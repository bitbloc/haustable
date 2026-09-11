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

async function checkArcadeLogs() {
    const { data, error } = await supabase
        .from('arcade_rewards_log')
        .select(`
            id,
            profile_id,
            score,
            reward_type,
            xhaus_rewarded,
            created_at,
            profiles (display_name, nickname)
        `)
        .order('created_at', { ascending: false });
    console.log('Error:', error);
    console.log('Arcade rewards log:', JSON.stringify(data, null, 2));
}
checkArcadeLogs();
