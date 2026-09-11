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

async function checkRLS() {
    // Check if we can sign in or check existing profiles
    const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, display_name, nickname')
        .limit(15);
    console.log('Profiles:', profiles?.length, profiles?.slice(0, 5));

    // Can we insert if we have a valid profile_id or not?
    // Let's test inserting with a profile_id as anon:
    if (profiles && profiles.length > 0) {
        const testProfile = profiles[0];
        console.log('Testing with profile:', testProfile.id);
        const { data, error } = await supabase
            .from('leaderboard')
            .insert({
                profile_id: testProfile.id,
                display_name: testProfile.display_name || 'TEST',
                score: 15
            });
        console.log('Insert with profile_id result:', { data, error });
    }
}
checkRLS();
