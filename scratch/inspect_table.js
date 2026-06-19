import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectTable() {
    console.log('--- Inspecting Columns of menu_items ---');
    const { data: cols, error: colError } = await supabase.rpc('inspect_columns_dummy_or_raw_sql', {});
    
    // Since we don't have a custom RPC for column inspection, let's run a query on info schema using a function if it exists.
    // If not, let's query via standard select or run an arbitrary SQL query via a generic RPC.
    // Wait, let's see if we have RPCs. Let's try to query information_schema or just fetch one row of menu_items and inspect keys.
    const { data: oneRow, error: rowError } = await supabase.from('menu_items').select('*').limit(1);
    if (rowError) {
        console.error('Row fetch error:', rowError);
    } else {
        console.log('Fields in menu_items:', Object.keys(oneRow[0] || {}));
        console.log('Sample row:', oneRow[0]);
    }
    
    // Let's also inspect policy settings if we can.
    // Let's see if there is any custom RPC we can call or if we can run custom queries.
    // Let's print all menu_items (including non-available ones).
    const { data: allItems, error: allErr } = await supabase.from('menu_items').select('*');
    if (allErr) {
        console.error('Error fetching all items:', allErr);
    } else {
        console.log(`\nAll ${allItems.length} items in menu_items table:`);
        allItems.forEach((it) => {
            console.log(` - ID: ${it.id}, Name: ${it.name}, Available: ${it.is_available}, Pickup: ${it.is_pickup_available}, Category: ${it.category}, Category_ID: ${it.category_id}`);
        });
    }
}

inspectTable();
