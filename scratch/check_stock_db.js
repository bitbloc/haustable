import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("=== CHECKING STOCK ITEMS ===");
    const { data: items, error: itemsError } = await supabase
        .from('stock_items')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (itemsError) {
        console.error("Error fetching stock items:", itemsError);
    } else {
        console.log("Sample stock items:");
        items.forEach(item => {
            console.log(`ID: ${item.id} | Name: ${item.name} | Current Qty: ${item.current_quantity} | Unit: ${item.unit} | Updated At: ${item.updated_at}`);
        });
    }

    console.log("\n=== CHECKING STOCK TRANSACTIONS ===");
    const { data: txs, error: txsError } = await supabase
        .from('stock_transactions')
        .select('*, stock_items(name)')
        .order('created_at', { ascending: false })
        .limit(10);

    if (txsError) {
        console.error("Error fetching transactions:", txsError);
    } else {
        console.log("Recent stock transactions:");
        txs.forEach(tx => {
            console.log(`Time: ${tx.created_at} | Item: ${tx.stock_items?.name} (${tx.stock_item_id}) | Type: ${tx.transaction_type} | Change: ${tx.quantity_change} | Performed By: ${tx.performed_by} | Note: ${tx.note}`);
        });
    }
}

run();
