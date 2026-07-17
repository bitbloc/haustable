require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function run() {
    console.log("Fetching all stock items...");
    const { data: items, error: itemsError } = await supabase
        .from('stock_items')
        .select('*');
    
    if (itemsError) {
        console.error("Error fetching stock items:", itemsError);
        return;
    }
    console.log(`Found ${items.length} stock items:`);
    console.log(items.map(item => ({
        id: item.id,
        name: item.name,
        current_quantity: item.current_quantity,
        unit: item.unit
    })));

    console.log("\nFetching all stock transactions...");
    const { data: txs, error: txError } = await supabase
        .from('stock_transactions')
        .select('*, stock_items(name)')
        .order('created_at', { ascending: false });

    if (txError) {
        console.error("Error fetching transactions:", txError);
        return;
    }
    console.log(`Found ${txs.length} transactions:`);
    console.log(txs.map(tx => ({
        id: tx.id,
        item_name: tx.stock_items ? tx.stock_items.name : 'Unknown',
        type: tx.transaction_type,
        qty_change: tx.quantity_change,
        performed_by: tx.performed_by,
        note: tx.note,
        created_at: tx.created_at
    })));
}

run();
