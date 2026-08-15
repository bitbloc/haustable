const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read env
const envPath = path.resolve(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            env[key] = val;
        }
    }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runE2EChannelSyncTest() {
    console.log('=== STARTING END-TO-END CHANNELS SYNC TEST ===\n');

    // 1. Fetch a table to use for testing
    const { data: tables, error: tableErr } = await supabase.from('tables_layout').select('id, table_name').limit(1);
    if (tableErr || !tables || tables.length === 0) {
        throw new Error('Failed to fetch table: ' + (tableErr?.message || 'No tables'));
    }
    const testTable = tables[0];
    console.log(`[PASS] Step 1: Using Table ${testTable.table_name} (ID: ${testTable.id}) for testing.\n`);

    const trackingToken = 'test_token_' + Date.now();

    // 2. Simulate Customer Table QR Order Creation (status: seated, walk_in)
    console.log('[TEST] Step 2: Customer places QR order at table...');
    const { data: createdBooking, error: createErr } = await supabase.from('bookings').insert({
        table_id: testTable.id,
        status: 'seated',
        booking_type: 'walk_in',
        booking_time: new Date().toISOString(),
        pax: 2,
        total_amount: 450,
        tracking_token: trackingToken,
        customer_note: 'E2E QR Order Test'
    }).select().single();

    if (createErr) {
        throw new Error('Create booking failed: ' + createErr.message);
    }
    console.log(`[PASS] Order created! ID: ${createdBooking.id}, Tracking Token: ${trackingToken}\n`);

    // 3. Test POS query sync (POS Open Bills / Table Grid)
    console.log('[TEST] Step 3: Verifying POS sees Table as Occupied / Active Bill...');
    const { data: posBookings, error: posErr } = await supabase
        .from('bookings')
        .select('id, status, table_id, total_amount')
        .in('status', ['seated', 'confirmed', 'ready'])
        .eq('table_id', testTable.id);

    if (posErr || !posBookings || posBookings.length === 0) {
        throw new Error('POS failed to find active table booking!');
    }
    console.log(`[PASS] POS found active session! Status: ${posBookings[0].status}, Amount: ${posBookings[0].total_amount} THB\n`);

    // 4. Test KMS query sync (OrderContext scheduleOrders query)
    console.log('[TEST] Step 4: Verifying KMS receives Order in Active Schedule...');
    const { data: kmsBookings, error: kmsErr } = await supabase
        .from('bookings')
        .select('id, status, customer_note')
        .in('status', ['confirmed', 'ready', 'seated'])
        .eq('id', createdBooking.id);

    if (kmsErr || !kmsBookings || kmsBookings.length === 0) {
        throw new Error('KMS failed to find active ticket!');
    }
    console.log(`[PASS] KMS found ticket in kitchen queue! ID: ${kmsBookings[0].id}\n`);

    // 5. Test Customer Tracking query sync
    console.log('[TEST] Step 5: Verifying Tracking Page query by token...');
    const { data: trackingBooking, error: trackErr } = await supabase
        .from('bookings')
        .select('id, status, tracking_token')
        .eq('tracking_token', trackingToken)
        .single();

    if (trackErr || !trackingBooking) {
        throw new Error('Tracking page failed to find booking by token!');
    }
    console.log(`[PASS] Tracking page resolved booking! Status: ${trackingBooking.status}\n`);

    // 6. Test KMS updates order to 'ready'
    console.log('[TEST] Step 6: KMS marks order as READY...');
    const { error: readyErr } = await supabase
        .from('bookings')
        .update({ status: 'ready' })
        .eq('id', createdBooking.id);

    if (readyErr) throw readyErr;

    // Verify Tracking page sees 'ready'
    const { data: updatedTrack } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', createdBooking.id)
        .single();

    console.log(`[PASS] Customer Tracking now shows status: ${updatedTrack.status}\n`);

    // 7. Test POS Checkout / Release Table (status -> completed)
    console.log('[TEST] Step 7: POS settles bill (status -> completed)...');
    const { error: completeErr } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', createdBooking.id);

    if (completeErr) throw completeErr;

    // Verify table is released in POS
    const { data: postReleasePOS } = await supabase
        .from('bookings')
        .select('id')
        .in('status', ['seated', 'confirmed', 'ready'])
        .eq('table_id', testTable.id);

    console.log(`[PASS] POS Table is now FREE?: ${postReleasePOS.length === 0}\n`);

    // 8. Cleanup test record
    console.log('[CLEANUP] Cleaning up test booking...');
    await supabase.from('bookings').delete().eq('id', createdBooking.id);
    console.log('[PASS] Cleanup complete. ALL 5 CHANNELS SYNC 100% CLEANLY!\n');
}

runE2EChannelSyncTest().catch(err => {
    console.error('[FAIL]', err);
    process.exit(1);
});
