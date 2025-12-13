
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugSupabase() {
    console.log('--- Starting Supabase Debug ---');

    // Test 1: Simple Health Check (if possible, or just a very basic query)
    // We'll try to select count from tables_layout first without filters
    console.log('Test 1: Select count from tables_layout (no filters)');
    const { count, error: countError } = await supabase
        .from('tables_layout')
        .select('*', { count: 'exact', head: true })

    if (countError) {
        console.error('Test 1 Failed:', countError.message, countError.details, countError.hint);
    } else {
        console.log('Test 1 Passed. Count:', count);
    }

    // Test 2: Select all columns with limit 1
    console.log('\nTest 2: Select * limit 1');
    const { data: data1, error: error1 } = await supabase
        .from('tables_layout')
        .select('*')
        .limit(1)

    if (error1) {
        console.error('Test 2 Failed:', error1.message);
    } else {
        console.log('Test 2 Passed. Data:', data1);
    }

    // Test 3: Select specific columns (maybe * is causing issues if a column type is weird?)
    console.log('\nTest 3: Select specific columns (id, table_name)');
    const { data: data2, error: error2 } = await supabase
        .from('tables_layout')
        .select('id, table_name')
        .limit(1)

    if (error2) {
        console.error('Test 3 Failed:', error2.message);
    } else {
        console.log('Test 3 Passed. Data:', data2);
    }

    // Test 4: The problematic query
    console.log('\nTest 4: The problematic query (is_active=true)');
    const { data: data3, error: error3 } = await supabase
        .from('tables_layout')
        .select('*')
        .eq('is_active', true)
        .order('id')

    if (error3) {
        console.error('Test 4 Failed:', error3.message, error3.details);
    } else {
        console.log('Test 4 Passed. Rows:', data3?.length);
    }

    console.log('--- End Debug ---');
}

debugSupabase();
