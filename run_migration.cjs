const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const connectionString = process.env.VITE_SUPABASE_URL
  .replace('https://', 'postgres://postgres:' + process.env.VITE_SUPABASE_KEY + '@')
  .replace('.supabase.co', '.supabase.co:5432/postgres');

const client = new Client({
  connectionString: connectionString
});

const sql = `
CREATE OR REPLACE FUNCTION process_drink_stamps(
    p_user_id UUID,
    p_stamp_count INT,
    p_quota_used INT
) RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET 
        drink_stamp_count = COALESCE(drink_stamp_count, 0) + p_stamp_count,
        total_drinks_purchased = COALESCE(total_drinks_purchased, 0) + p_stamp_count,
        free_drink_quota = COALESCE(free_drink_quota, 0) - p_quota_used
    WHERE id = p_user_id;

    UPDATE public.profiles
    SET 
        free_drink_quota = COALESCE(free_drink_quota, 0) + floor(drink_stamp_count / 10),
        drink_stamp_count = drink_stamp_count % 10
    WHERE id = p_user_id AND drink_stamp_count >= 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

client.connect()
  .then(() => client.query(sql))
  .then(() => console.log('Successfully created process_drink_stamps RPC!'))
  .catch(err => console.error('Error:', err))
  .finally(() => client.end());
