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

async function testGuestInsert() {
    const { data, error } = await supabase
        .from('leaderboard')
        .insert({
            display_name: 'TEST GUEST',
            score: 10
        })
        .select();
    console.log('Guest insert result:', { data, error });
}
testGuestInsert();
