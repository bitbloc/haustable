require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

// Pick a test item — ซอสแม็กกี้/ขวด
const TEST_ITEM_ID = '9e429214-de06-48fb-83c3-15b552e4e922';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getQty() {
    const { data } = await supabase
        .from('stock_items')
        .select('current_quantity')
        .eq('id', TEST_ITEM_ID)
        .single();
    return data?.current_quantity;
}

async function run() {
    console.log("╔═══════════════════════════════════════════════════════════╗");
    console.log("║       STOCK DATA CONSISTENCY DIAGNOSTIC TOOL             ║");
    console.log("╚═══════════════════════════════════════════════════════════╝\n");
    
    // ==========================================
    // TEST 1: Single RPC idempotency
    // ==========================================
    console.log("━━━ TEST 1: RPC SET OPERATION CONSISTENCY ━━━");
    const initQty = await getQty();
    console.log(`  Initial quantity: ${initQty}`);
    
    // Set to a known value
    const testVal = 99.1234;
    const { error: e1 } = await supabase.rpc('set_stock_quantity', {
        p_item_id: TEST_ITEM_ID,
        p_new_quantity: testVal,
        p_reason: 'Diagnostic Test 1',
        p_performed_by: 'Antigravity Diagnostic'
    });
    if (e1) { console.error("  RPC Error:", e1.message); return; }
    
    await sleep(500);
    const afterSet = await getQty();
    console.log(`  After SET to ${testVal}: got ${afterSet}`);
    console.log(`  ✅ Match: ${Math.abs(afterSet - testVal) < 0.001 ? 'YES ✓' : 'NO ✗ — INCONSISTENCY DETECTED!'}`);
    
    // ==========================================
    // TEST 2: Rapid consecutive SETs (simulating fast UI clicks)
    // ==========================================
    console.log("\n━━━ TEST 2: RAPID CONSECUTIVE SETs (Race Simulation) ━━━");
    const rapidValues = [10, 20, 30, 40, 50];
    
    // Fire all RPCs simultaneously (no await between them)
    const promises = rapidValues.map((val, i) => 
        supabase.rpc('set_stock_quantity', {
            p_item_id: TEST_ITEM_ID,
            p_new_quantity: val,
            p_reason: `Rapid Test ${i+1}`,
            p_performed_by: 'Antigravity Rapid'
        })
    );
    
    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);
    console.log(`  Fired ${rapidValues.length} concurrent SETs: ${errors.length} errors`);
    
    await sleep(1500);
    const afterRapid = await getQty();
    console.log(`  Final value after rapid SETs: ${afterRapid}`);
    console.log(`  Expected: Unpredictable (depends on trigger execution order)`);
    console.log(`  ⚠️  This demonstrates the core issue: concurrent SET operations`);
    console.log(`     will race because each one reads old value, calculates diff,`);
    console.log(`     inserts transaction, and the trigger adds that diff.`);
    
    // Explanation:
    // If current=99.1234:
    //   SET 10 → diff = 10-99.1234 = -89.1234 → trigger adds -89.1234 → qty = 10
    //   SET 20 → diff = 20-99.1234 = -79.1234 → trigger adds -79.1234 → qty = 10 + -79.1234 = -69.1234 !!!
    // Each SET reads the OLD value (99.1234) but the trigger accumulates ALL diffs!
    
    // ==========================================
    // TEST 3: Check what actually happened with sequential sets
    // ==========================================
    console.log("\n━━━ TEST 3: SEQUENTIAL SET OPERATIONS (Correct Behavior) ━━━");
    
    // First, set to a known baseline
    await supabase.rpc('set_stock_quantity', {
        p_item_id: TEST_ITEM_ID,
        p_new_quantity: 5.0,
        p_reason: 'Baseline Reset',
        p_performed_by: 'Antigravity Sequential'
    });
    await sleep(500);
    const baseline = await getQty();
    console.log(`  Baseline: ${baseline}`);
    
    // Now do sequential sets with proper awaits
    for (const val of [10, 15, 8]) {
        const before = await getQty();
        await supabase.rpc('set_stock_quantity', {
            p_item_id: TEST_ITEM_ID,
            p_new_quantity: val,
            p_reason: `Sequential Set to ${val}`,
            p_performed_by: 'Antigravity Sequential'
        });
        await sleep(300);
        const after = await getQty();
        const match = Math.abs(after - val) < 0.001;
        console.log(`  SET ${val}: before=${before}, after=${after} ${match ? '✓' : '✗ WRONG!'}`);
    }
    
    // ==========================================
    // TEST 4: Simulate the exact UI flow (optimistic + realtime + verification fetch)
    // ==========================================
    console.log("\n━━━ TEST 4: SIMULATED UI FLOW (Optimistic → RPC → Verify) ━━━");
    
    // Start with qty=8 from previous test
    let localState = await getQty();
    console.log(`  Local state starts at: ${localState}`);
    
    // User clicks to set to 12
    const targetVal = 12;
    
    // Step 1: Optimistic update (UI does this immediately)
    localState = targetVal;
    console.log(`  [Optimistic] Local state → ${localState}`);
    
    // Step 2: RPC call
    await supabase.rpc('set_stock_quantity', {
        p_item_id: TEST_ITEM_ID,
        p_new_quantity: targetVal,
        p_reason: 'UI Flow Test',
        p_performed_by: 'Antigravity UI'
    });
    
    // Step 3: During RPC processing, the real-time listener would fire and overwrite local state
    // In the real app, this is where the flicker happens
    await sleep(200);
    const realtimeValue = await getQty();
    console.log(`  [Realtime would push] DB value: ${realtimeValue}`);
    
    // Step 4: Verification fetch overwrites again
    const verifyValue = await getQty();
    localState = verifyValue;
    console.log(`  [Verify fetch] Final DB value: ${verifyValue}`);
    console.log(`  Match: ${Math.abs(verifyValue - targetVal) < 0.001 ? 'YES ✓' : 'NO ✗'}`);
    
    // ==========================================
    // TEST 5: The critical bug — fallback with stale currentQty
    // ==========================================
    console.log("\n━━━ TEST 5: FALLBACK PATH BUG SIMULATION ━━━");
    console.log("  This test demonstrates what happens when the RPC fails");
    console.log("  and the fallback uses stale currentQty from local state.");
    console.log("");
    
    // Set to known value first
    await supabase.rpc('set_stock_quantity', {
        p_item_id: TEST_ITEM_ID,
        p_new_quantity: 10,
        p_reason: 'Fallback Bug Setup',
        p_performed_by: 'Antigravity'
    });
    await sleep(500);
    
    // Simulate: localState says current is 10, user sets to 15
    // But another user already changed it to 20 in the background
    await supabase.rpc('set_stock_quantity', {
        p_item_id: TEST_ITEM_ID,
        p_new_quantity: 20,
        p_reason: 'Concurrent User Change',
        p_performed_by: 'Other User'
    });
    await sleep(500);
    
    const dbValueNow = await getQty();
    const staleLocalValue = 10; // this is what the first user's browser still thinks
    const userWantsToSet = 15;
    
    console.log(`  DB is actually at: ${dbValueNow}`);
    console.log(`  User's stale local state: ${staleLocalValue}`);
    console.log(`  User wants to SET to: ${userWantsToSet}`);
    
    // Fallback calculates diff as: roundedChange - currentQty
    const fallbackDiff = userWantsToSet - staleLocalValue; // 15 - 10 = +5
    console.log(`  Fallback diff calculation: ${userWantsToSet} - ${staleLocalValue} = ${fallbackDiff}`);
    console.log(`  DB would become: ${dbValueNow} + ${fallbackDiff} = ${dbValueNow + fallbackDiff} (trigger adds diff)`);
    console.log(`  Expected: 15, Actual would be: ${dbValueNow + fallbackDiff}`);
    console.log(`  ❌ WRONG! This is the data inconsistency bug.`);
    
    // ==========================================
    // CLEANUP: Restore original value
    // ==========================================
    console.log("\n━━━ CLEANUP ━━━");
    await supabase.rpc('set_stock_quantity', {
        p_item_id: TEST_ITEM_ID,
        p_new_quantity: initQty,
        p_reason: 'Diagnostic Cleanup - Restored Original',
        p_performed_by: 'Antigravity Diagnostic'
    });
    await sleep(500);
    const restored = await getQty();
    console.log(`  Restored to: ${restored} (original was ${initQty})`);
    
    // ==========================================
    // SUMMARY
    // ==========================================
    console.log("\n╔═══════════════════════════════════════════════════════════╗");
    console.log("║                    DIAGNOSIS SUMMARY                     ║");
    console.log("╠═══════════════════════════════════════════════════════════╣");
    console.log("║                                                         ║");
    console.log("║  ROOT CAUSE #1: Race Condition in set_stock_quantity RPC ║");
    console.log("║  The RPC reads current qty, calculates a DIFF, and      ║");
    console.log("║  inserts a transaction. The trigger then ADDS the diff.  ║");
    console.log("║  If 2 SETs fire at the same time (both read the same    ║");
    console.log("║  old value), the diffs accumulate incorrectly.           ║");
    console.log("║                                                         ║");
    console.log("║  ROOT CAUSE #2: Triple State Update in UI               ║");
    console.log("║  StockPage.jsx updates state 3 times per adjustment:    ║");
    console.log("║    1. Optimistic update (immediate)                     ║");
    console.log("║    2. Realtime subscription (when DB changes)           ║");
    console.log("║    3. Verification fetch (after RPC completes)          ║");
    console.log("║  These race against each other, causing 'flickering'.   ║");
    console.log("║                                                         ║");
    console.log("║  ROOT CAUSE #3: Fallback Path Uses Stale Data           ║");
    console.log("║  If the RPC fails and falls back to direct insert,      ║");
    console.log("║  it calculates diff from local (possibly stale) state.  ║");
    console.log("║  This causes PERMANENT data corruption.                 ║");
    console.log("║                                                         ║");
    console.log("╚═══════════════════════════════════════════════════════════╝");
}

run().catch(console.error);
