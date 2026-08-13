const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const connectionString = process.env.VITE_SUPABASE_URL
  .replace('https://', 'postgres://postgres:' + process.env.VITE_SUPABASE_KEY + '@')
  .replace('.supabase.co', '.supabase.co:5432/postgres');

const client = new Client({ connectionString });

async function inspect() {
  await client.connect();
  console.log('--- TABLES ---');
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  console.log(tables.rows.map(r => r.table_name));

  console.log('\n--- FUNCTIONS / RPCs ---');
  const funcs = await client.query(`
    SELECT routine_name, routine_type 
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
    ORDER BY routine_name;
  `);
  console.log(funcs.rows.map(r => `${r.routine_name} (${r.routine_type})`));

  console.log('\n--- TRIGGERS ---');
  const triggers = await client.query(`
    SELECT trigger_name, event_object_table, action_statement, action_timing, event_manipulation
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name;
  `);
  console.log(triggers.rows);

  console.log('\n--- INDEXES ---');
  const indexes = await client.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);
  console.log(indexes.rows);

  await client.end();
}

inspect().catch(err => {
  console.error(err);
  client.end();
});
