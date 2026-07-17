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

    console.log("\n=== STEP 2: CALLING set_stock_quantity TO SET TO 5.0 ===");
    const { error: rpcErr1 } = await supabase.rpc('set_stock_quantity', {
        p_item_id: TEST_ITEM_ID,
        p_new_quantity: 5.0,
        p_reason: 'Antigravity DB Test Set',
        p_performed_by: 'Antigravity Debug'
    });

    if (rpcErr1) {
        console.error("RPC Error:", rpcErr1);
    } else {
        console.log("RPC completed successfully.");
    }

    // Wait a brief moment to ensure trigger/db processes finished
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("\n=== STEP 3: FETCHING ITEM VALUE AFTER SETTING TO 5.0 ===");
    const { data: item2 } = await supabase
        .from('stock_items')
        .select('*')
        .eq('id', TEST_ITEM_ID)
        .single();
    console.log("Post-set Item:", { name: item2.name, current_quantity: item2.current_quantity });

    console.log("\n=== STEP 4: CALLING set_stock_quantity TO RESTORE ORIGINAL VALUE ===");
    const { error: rpcErr2 } = await supabase.rpc('set_stock_quantity', {
        p_item_id: TEST_ITEM_ID,
        p_new_quantity: originalQty,
        p_reason: 'Antigravity DB Test Restore',
        p_performed_by: 'Antigravity Debug'
    });

    if (rpcErr2) {
        console.error("RPC Error:", rpcErr2);
    } else {
        console.log("RPC completed successfully.");
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

run();
