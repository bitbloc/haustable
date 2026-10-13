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

async function main() {
    console.log('--- 1. Querying pos_shifts for 2026-10-12 ---');
    const { data: shifts, error: sErr } = await supabase
        .from('pos_shifts')
        .select('*')
        .order('opened_at', { ascending: true });
    
    if (sErr) console.error('Shifts error:', sErr);
    
    // Filter shifts for today 2026-10-12 or recent
    const todayShifts = (shifts || []).filter(s => {
        const d = (s.opened_at || '').substring(0, 10);
        return d === '2026-10-12';
    });
    console.log(`Found ${todayShifts.length} shifts for 2026-10-12:`);
    todayShifts.forEach(s => {
        console.log({
            id: s.id,
            staff_name: s.staff_name,
            opened_at: s.opened_at,
            closed_at: s.closed_at,
            status: s.status,
            opening_float: s.opening_float,
            cash_sales: s.cash_sales,
            total_in: s.total_in,
            total_out: s.total_out,
            expected_cash: s.expected_cash,
            closed_cash: s.closed_cash,
            difference: s.difference,
            adjustments: s.adjustments
        });
    });

    const shift1 = todayShifts.find(s => (s.staff_name || '').toLowerCase().includes('casper')) || todayShifts[0];

    if (shift1) {
        console.log('\n--- Shift 1 Adjustments Details ---');
        console.log(JSON.stringify(shift1.adjustments, null, 2));

        console.log('\n--- Shift 1 Timeframe ---');
        console.log('Opened:', shift1.opened_at, 'Closed:', shift1.closed_at);

        console.log('\n--- 2. Orders / Bookings during Shift 1 ---');
        // Let's query bookings / orders between opened_at and closed_at
        const start = shift1.opened_at;
        const end = shift1.closed_at || new Date().toISOString();

        const { data: orders, error: oErr } = await supabase
            .from('bookings')
            .select('*')
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: true });
        
        if (oErr) console.error('Orders error:', oErr);
        console.log(`Found ${orders ? orders.length : 0} bookings/orders during shift:`);
        (orders || []).forEach(o => {
            console.log(`ID: ${o.id} | Time: ${o.created_at} | Status: ${o.status} | Total: ${o.total_amount} | Payment: ${o.payment_method || o.payment_type} | Type: ${o.booking_type} | Table: ${o.table_number || o.table_id || o.table_name} | PaidAt: ${o.paid_at}`);
        });

        // Also check if there's a pos_orders or similar table
        const { data: posOrders, error: poErr } = await supabase
            .from('pos_orders')
            .select('*')
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: true });
        if (!poErr && posOrders) {
            console.log(`Found ${posOrders.length} pos_orders during shift`);
            posOrders.forEach(o => console.log(o));
        }

        // Also check payments table if exists
        const { data: payments, error: pErr } = await supabase
            .from('pos_payments')
            .select('*')
            .gte('created_at', start)
            .lte('created_at', end);
        if (!pErr && payments) {
            console.log(`Found ${payments.length} pos_payments`);
        }
    }
}

main().catch(console.error);
