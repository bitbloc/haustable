
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { data, error } = await supabase
    .from('tables_layout')
    .select('id, table_name, pos_x, pos_y, width, height')
    .order('table_name');

  if (error) {
    console.error('Error fetching tables:', error);
    return;
  }

  console.log('--- Tables Layout ---');
  data.forEach(t => {
      console.log(`ID: ${t.id} | Name: ${t.table_name} | Pos: (${t.pos_x}, ${t.pos_y}) | Size: ${t.width}x${t.height}`);
  });
}

checkTables();
