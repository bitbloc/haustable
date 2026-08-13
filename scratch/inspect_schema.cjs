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

async function inspectBookingsSchema() {
    const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error('Error fetching bookings:', error);
        return;
    }

    console.log('Sample booking object keys:', Object.keys(data[0] || {}));
    console.log('Latest 3 bookings:', data);

    console.log('\n--- Members named bam ---');
    const { data: members } = await supabase
        .from('profiles')
        .select('*')
        .or('display_name.ilike.%bam%,nickname.ilike.%bam%');
    console.log('Members matching bam:', members);
}

inspectBookingsSchema();
