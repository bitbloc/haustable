require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function run() {
    console.log("Fetching stock transactions...");
    const { data: txs, error: txError } = await supabase.from('stock_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
        
    console.log("Last 5 Transactions:");
    console.log(txs);
    
    if (txs && txs.length > 0) {
        const testItemId = txs[0].stock_item_id;
        console.log(`\nFetching stock item ${testItemId}...`);
        const { data: item } = await supabase.from('stock_items').select('*').eq('id', testItemId).single();
        console.log(item);
    }
}
run();
