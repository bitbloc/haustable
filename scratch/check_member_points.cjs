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

async function checkMember() {
    const { data: p } = await supabase
        .from('profiles')
        .select('id, display_name, nickname, xhaus_balance, total_earned_xhaus, drink_stamp_count')
        .eq('id', '65fad52d-af59-4c40-a78b-76518d25e609')
        .single();
    console.log('Member profile 65fad52d:', p);
}
checkMember();
