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

async function findBam() {
    console.log('Searching all profiles...');
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, display_name, nickname, phone_number, current_tier, xhaus_balance')
        .limit(100);

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log(`Found ${profiles.length} total profiles.`);
    const matching = profiles.filter(p => {
        const d = (p.display_name || '').toLowerCase();
        const n = (p.nickname || '').toLowerCase();
        return d.includes('bam') || n.includes('bam') || d.includes('admin') || n.includes('admin');
    });

    console.log('Matching profiles:', matching);
    if (matching.length === 0) {
        console.log('Top 10 profiles in system:');
        console.log(profiles.slice(0, 10));
    }
}

findBam();
