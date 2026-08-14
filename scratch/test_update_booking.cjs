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

async function testUpdate() {
    const testUserId = '8f3ee286-700b-4b7f-9926-ff9a51e24070'; // banff line
    const { data: latestBooking } = await supabase.from('bookings').select('id, user_id, status').order('created_at', { ascending: false }).limit(1).single();
    console.log('Latest booking before update:', latestBooking);
    
    if (latestBooking) {
        const { data, error } = await supabase
            .from('bookings')
            .update({ user_id: testUserId })
            .eq('id', latestBooking.id)
            .select();
            
        console.log('Update result:', data, error);
    }
}

testUpdate();
