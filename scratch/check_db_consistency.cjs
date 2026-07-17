require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function run() {
    console.log("Checking DB Consistency: Sum of transactions vs current_quantity in stock_items...");
    
    // Fetch all stock items
    const { data: items, error: itemsError } = await supabase
        .from('stock_items')
        .select('id, name, current_quantity');
        
    if (itemsError) {
        console.error("Error fetching items:", itemsError);
        return;
    }

    // Fetch all transactions
    const { data: txs, error: txsError } = await supabase
        .from('stock_transactions')
        .select('stock_item_id, quantity_change');
        
    if (txsError) {
        console.error("Error fetching transactions:", txsError);
        return;
    }

    // Calculate sum per item
    const txSums = {};
    txs.forEach(tx => {
        if (!txSums[tx.stock_item_id]) {
            txSums[tx.stock_item_id] = 0;
        }
        txSums[tx.stock_item_id] += tx.quantity_change;
    });

    console.log("\nComparison Results (first 10 items or inconsistent items):");
    let inconsistentCount = 0;
    
    for (const item of items) {
        const sum = txSums[item.id] || 0;
        const current = item.current_quantity || 0;
        const diff = Math.abs(current - sum);
        
        // We use a small epsilon for float comparison
        if (diff > 0.0001) {
            inconsistentCount++;
            console.log(`❌ INCONSISTENT: "${item.name}" (ID: ${item.id})`);
            console.log(`   current_quantity in stock_items:  ${current}`);
            console.log(`   sum of transactions quantity_change: ${sum}`);
            console.log(`   Difference:                        ${diff}`);
        }
    }
    
    console.log(`\nTotal items checked: ${items.length}`);
    console.log(`Total inconsistent items found: ${inconsistentCount}`);
}

run();
