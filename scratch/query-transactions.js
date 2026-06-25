import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Query all transactions from today (June 24th, 2026)
  const { data: txs, error } = await supabase
    .from('stock_transactions')
    .select(`
      id,
      created_at,
      quantity_change,
      transaction_type,
      performed_by,
      stock_items ( name, current_quantity, min_stock_threshold )
    `)
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) {
    console.error("Error querying transactions:", error);
    return;
  }
  
  console.log("=== TRANSACTIONS FOR TODAY (JUNE 24) ===");
  txs.forEach(t => {
    console.log(`[${t.created_at}] Item: ${t.stock_items?.name}, Change: ${t.quantity_change}, Type: ${t.transaction_type}, By: ${t.performed_by}`);
  });
}

run();
