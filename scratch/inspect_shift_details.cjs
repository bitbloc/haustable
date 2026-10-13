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

async function inspect() {
    const start = '2026-10-12T03:00:00.000Z';
    const end = '2026-10-12T11:00:00.000Z';

    console.log('--- Checking bookings detail ---');
    const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true });

    bookings.forEach(b => {
        console.log({
            id: b.id,
            created_at: b.created_at,
            table: b.table_number || b.table_name || b.table_id,
            total_amount: b.total_amount,
            status: b.status,
            customer_name: b.customer_name,
            payment_status: b.payment_status,
            payment_method: b.payment_method,
            slip_url: b.slip_url ? 'HAS_SLIP' : null,
            items: b.items ? (Array.isArray(b.items) ? b.items.length : typeof b.items) : null,
            raw_metadata: b.metadata
        });
    });

    console.log('\n--- Checking audit logs or pos logs if any ---');
    const { data: audit, error: aErr } = await supabase
        .from('audit_logs')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true });
    
    if (!aErr && audit) {
        console.log(`Audit logs count: ${audit.length}`);
        audit.forEach(l => console.log(l));
    } else {
        console.log('No audit_logs or error:', aErr?.message);
    }

    console.log('\n--- Checking payments table ---');
    const { data: payments, error: pErr } = await supabase
        .from('payments')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end);
    if (!pErr && payments) {
        console.log(`Payments count: ${payments.length}`);
        payments.forEach(p => console.log(p));
    } else {
        console.log('Payments table:', pErr?.message);
    }
}

inspect().catch(console.error);
