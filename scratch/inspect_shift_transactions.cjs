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

async function inspectShift() {
    const { data: shift } = await supabase
        .from('pos_shifts')
        .select('*')
        .eq('id', 'shift_1791774516770')
        .single();

    console.log('--- Shift Data ---');
    console.log('ID:', shift.id);
    console.log('Staff:', shift.staff_name);
    console.log('Opening float:', shift.opening_float);
    console.log('Cash sales:', shift.cash_sales);
    console.log('QR sales:', shift.qr_sales);
    console.log('Credit sales:', shift.credit_sales);
    console.log('Total sales:', shift.total_sales);
    console.log('Total In:', shift.total_in);
    console.log('Total Out:', shift.total_out);
    console.log('Expected cash:', shift.expected_cash);
    console.log('Closed cash:', shift.closed_cash);
    console.log('Difference:', shift.difference);
    console.log('\n--- Transactions in Shift ---');
    console.log(JSON.stringify(shift.transactions, null, 2));
}

inspectShift().catch(console.error);
