require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

const TEST_ITEM_ID = '9e429214-de06-48fb-83c3-15b552e4e922'; // ซอสแม็กกี้/ขวด

async function run() {
    console.log("=== STEP 1: FETCHING INITIAL ITEM VALUE ===");
    const { data: item1, error: err1 } = await supabase
        .from('stock_items')
        .select('*')
        .eq('id', TEST_ITEM_ID)
        .single();
    
    if (err1) {
        console.error("Error fetching item:", err1);
        return;
    }
    console.log("Initial Item:", { name: item1.name, current_quantity: item1.current_quantity });
    const originalQty = item1.current_quantity;

    console.log("\n=== STEP 2: INSERTING 'in' TRANSACTION WITH quantity_change = 2.0 ===");
    // Wait, since we are doing this using the anon key, does it have permission to insert into stock_transactions?
    // Let's see!
    const { data: tx, error: txErr } = await supabase
        .from('stock_transactions')
        .insert({
            stock_item_id: TEST_ITEM_ID,
            transaction_type: 'in',
            quantity_change: 2.0,
            performed_by: 'Antigravity Relative Debug',
            note: 'Antigravity Relative Test'
        })
        .select()
        .single();

    if (txErr) {
        console.error("Insert Error (might be because of RLS):", txErr.message);
        console.log("Since we are anon, RLS might block this. Let's see if we can do this.");
    } else {
        console.log("Insert completed successfully:", tx);
    }

    // Wait a brief moment to ensure trigger/db processes finished
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("\n=== STEP 3: FETCHING ITEM VALUE AFTER INSERT ===");
    const { data: item2 } = await supabase
        .from('stock_items')
        .select('*')
        .eq('id', TEST_ITEM_ID)
        .single();
    console.log("Post-insert Item:", { name: item2.name, current_quantity: item2.current_quantity });

    // Clean up if we successfully inserted
    if (!txErr && tx) {
        console.log("\n=== STEP 4: CLEANING UP - INSERTING 'out' TRANSACTION WITH quantity_change = -2.0 ===");
        const { error: cleanupErr } = await supabase
            .from('stock_transactions')
            .insert({
                stock_item_id: TEST_ITEM_ID,
                transaction_type: 'out',
                quantity_change: -2.0,
                performed_by: 'Antigravity Relative Debug Cleanup',
                note: 'Antigravity Relative Test Cleanup'
            });
        if (cleanupErr) {
            console.error("Cleanup Insert Error:", cleanupErr.message);
        } else {
            console.log("Cleanup Insert completed successfully.");
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log("\n=== STEP 5: FETCHING FINAL RESTORED ITEM VALUE ===");
        const { data: item3 } = await supabase
            .from('stock_items')
            .select('*')
            .eq('id', TEST_ITEM_ID)
            .single();
        console.log("Final Restored Item:", { name: item3.name, current_quantity: item3.current_quantity });
    }
}

run();
