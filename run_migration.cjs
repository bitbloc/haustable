const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

const connectionString = process.env.VITE_SUPABASE_URL
  .replace('https://', 'postgres://postgres:' + process.env.VITE_SUPABASE_KEY + '@')
  .replace('.supabase.co', '.supabase.co:5432/postgres');

const client = new Client({
  connectionString: connectionString
});

const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260813200000_system_wide_sql_optimization.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

client.connect()
  .then(() => {
    console.log('Connected to Supabase PostgreSQL database.');
    return client.query(sql);
  })
  .then(() => console.log('Successfully applied 20260813200000_system_wide_sql_optimization.sql!'))
  .catch(err => console.error('Error applying migration:', err))
  .finally(() => client.end());

