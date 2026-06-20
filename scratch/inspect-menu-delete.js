import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lxfavbzmebqqsffgyyph.supabase.co';
// Use anon key or service role key if available in process.env
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Searching for menu items matching "Flat Iron"...');
  const { data: items, error: findError } = await supabase
    .from('menu_items')
    .select('*')
    .ilike('name', '%Flat Iron%');

  if (findError) {
    console.error('Find Error:', findError);
    return;
  }

  console.log('Found items:', items);
  if (!items || items.length === 0) {
    console.log('No item found.');
    return;
  }

  const target = items[0];
  console.log(`Attempting to delete item "${target.name}" with ID: ${target.id}...`);

  const { error: deleteError } = await supabase
    .from('menu_items')
    .delete()
    .eq('id', target.id);

  if (deleteError) {
    console.error('Delete Failed! Error Details:', deleteError);
  } else {
    console.log('Delete Succeeded on DB!');
  }
}

run();
