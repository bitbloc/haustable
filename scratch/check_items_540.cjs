const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let env = {};
try {
    env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
        if (!line || !line.includes('=')) return acc;
        const parts = line.split('=');
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/['"]+/g, '');
        if(key) acc[key] = val;
        return acc;
    }, {});
} catch(e) {}

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrderItems() {
    const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .gte('created_at', '2026-10-12T03:00:00.000Z')
        .lte('created_at', '2026-10-12T11:00:00.000Z');

    console.log('Order items count:', items ? items.length : 0);
    if (items) {
        // check if any single item or group has 540
        const items540 = items.filter(it => it.price === 540 || (it.price * it.quantity) === 540);
        console.log('Items matching 540:', items540);
    }
}

checkOrderItems().catch(console.error);
