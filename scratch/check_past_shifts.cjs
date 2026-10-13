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

async function checkPastShifts() {
    const { data: shifts } = await supabase
        .from('pos_shifts')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(10);

    shifts.forEach(s => {
        console.log({
            id: s.id,
            staff: s.staff_name,
            opened_at: s.opened_at,
            closed_at: s.closed_at,
            status: s.status,
            opening_float: s.opening_float,
            closed_cash: s.closed_cash,
            expected_cash: s.expected_cash,
            difference: s.difference,
            cash_sales: s.cash_sales,
            total_in: s.total_in,
            total_out: s.total_out
        });
    });
}

checkPastShifts().catch(console.error);
