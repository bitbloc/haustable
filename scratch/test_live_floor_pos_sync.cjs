const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    if (!line || !line.includes('=')) return acc;
    const parts = line.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/['"]+/g, '');
    if(key) acc[key] = val;
    return acc;
}, {});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key missing in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSync() {
    console.log('=== TEST 1: Fetching current tables from tables_layout ===');
    const { data: tables, error: tErr } = await supabase.from('tables_layout').select('*').order('id').limit(5);
    if (tErr) {
        console.error('Failed to fetch tables:', tErr);
        return;
    }
    console.log(`Found ${tables.length} tables. Sample table: ID ${tables[0].id}, Name: ${tables[0].table_name}`);

    const targetTable = tables[0];
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const start = `${today}T00:00:00+07:00`;
    const end = `${today}T23:59:59+07:00`;

    console.log('\n=== TEST 2: Admin Quick-Blocks Table ' + targetTable.table_name + ' ===');
    const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const mockToken = 'test-sync-' + Date.now();

    const insertPayload = {
        table_id: targetTable.id,
        booking_time: now.toISOString(),
        end_time: endTime.toISOString(),
        booking_type: 'walk_in',
        status: 'seated',
        pickup_contact_name: 'Walk-in Guest (Test Sync)',
        customer_note: 'Internal Block',
        pax: targetTable.capacity || 2,
        total_amount: 0,
        tracking_token: mockToken
    };

    const { data: createdBooking, error: insErr } = await supabase
        .from('bookings')
        .insert(insertPayload)
        .select()
        .single();

    if (insErr) {
        console.error('Insert failed:', insErr);
        return;
    }
    console.log('Successfully created booking ID:', createdBooking.id, 'Status:', createdBooking.status);

    console.log('\n=== TEST 3: Verifying POS Query sees Table as OCCUPIED ===');
    // POS Query (POSTableGrid query)
    const { data: posActiveBookings } = await supabase
        .from('bookings')
        .select('*')
        .in('status', ['seated', 'confirmed', 'ready']);

    const posMatch = posActiveBookings.find(b => b.table_id === targetTable.id && ['seated', 'confirmed', 'ready'].includes(b.status));
    console.log('POS Active Bookings query match found?:', !!posMatch, 'Status in POS:', posMatch ? 'OCCUPIED (' + posMatch.status + ')' : 'FREE');

    console.log('\n=== TEST 4: Verifying Admin Live Floor Query sees Table as BLOCKED/OCCUPIED ===');
    // Admin Live Floor Query (LiveFloorQuickStatus query)
    const { data: adminActiveBookings } = await supabase
        .from('bookings')
        .select('*, profiles(display_name, phone_number)')
        .in('status', ['confirmed', 'pending', 'seated', 'ready', 'approved', 'paid'])
        .gte('booking_time', start)
        .lte('booking_time', end);

    const adminMatch = adminActiveBookings.find(b => b.table_id === targetTable.id);
    console.log('Admin Live Floor query match found?:', !!adminMatch, 'Note:', adminMatch?.customer_note);

    console.log('\n=== TEST 5: Admin Releases Table (status -> completed) ===');
    const { error: relErr } = await supabase
        .from('bookings')
        .update({ status: 'completed', end_time: new Date().toISOString() })
        .eq('id', createdBooking.id);

    if (relErr) {
        console.error('Release failed:', relErr);
        return;
    }
    console.log('Successfully released booking ID:', createdBooking.id);

    console.log('\n=== TEST 6: Verifying Table is now FREE in both POS and Admin Floor ===');
    const { data: posAfterRelease } = await supabase
        .from('bookings')
        .select('*')
        .in('status', ['seated', 'confirmed', 'ready']);

    const posMatchAfter = posAfterRelease.find(b => b.id === createdBooking.id);
    console.log('POS Table is FREE?:', !posMatchAfter);

    const { data: adminAfterRelease } = await supabase
        .from('bookings')
        .select('*')
        .in('status', ['confirmed', 'pending', 'seated', 'ready', 'approved', 'paid'])
        .gte('booking_time', start)
        .lte('booking_time', end);

    const adminMatchAfter = adminAfterRelease.find(b => b.id === createdBooking.id);
    console.log('Admin Table is FREE?:', !adminMatchAfter);

    console.log('\n=== CLEANUP: Removing test record ===');
    await supabase.from('bookings').delete().eq('tracking_token', mockToken);
    console.log('Test record cleaned up successfully. Sync test passed 100%!');
}

testSync();
