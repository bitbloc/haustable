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

async function findProfile() {
    console.log('Calling find_profile_by_name for bam...');
    const { data: bamData, error: e1 } = await supabase.rpc('find_profile_by_name', { p_name: 'bam' });
    console.log('Bam search result:', bamData, e1);

    console.log('Calling find_profile_by_name for empty string (all profiles)...');
    const { data: allData, error: e2 } = await supabase.rpc('find_profile_by_name', { p_name: '' });
    console.log('All profiles count:', allData ? allData.length : 0, allData ? allData.slice(0, 10) : null);
}

findProfile();
