require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

const tablesToCheck = [
  'bookings',
  'order_items',
  'profiles',
  'menu_items',
  'menu_categories',
  'menu_options',
  'tables_layout',
  'stock_items',
  'stock_transactions',
  'recipe_ingredients',
  'pos_shifts',
  'sop_guides',
  'sop_categories',
  'arcade_rewards_log',
  'arcade_leaderboard',
  'song_requests',
  'app_settings',
  'xhaus_rewards'
];

async function run() {
  console.log("=== SUPABASE TABLE SUMMARY ===");
  for (const table of tablesToCheck) {
    const { data, count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ Table '${table}': ERROR -> ${error.message} (${error.code})`);
    } else {
      console.log(`✅ Table '${table}': ${count} rows`);
    }
  }

  console.log("\n=== TESTING RPC FUNCTIONS ===");
  const rpcsToTest = [
    { name: 'get_member_tier_details', args: { p_user_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'get_member_service_history', args: { p_user_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'process_drink_stamps', args: { p_user_id: '00000000-0000-0000-0000-000000000000', p_stamp_count: 0, p_quota_used: 0 } },
    { name: 'process_checkout_xhaus', args: { p_booking_id: '00000000-0000-0000-0000-000000000000', p_xhaus_earned: 0, p_xhaus_redeemed: 0, p_xhaus_discount: 0 } }
  ];

  for (const rpc of rpcsToTest) {
    const { data, error } = await supabase.rpc(rpc.name, rpc.args);
    if (error) {
      console.log(`❌ RPC '${rpc.name}': ERROR -> ${error.message} (${error.code})`);
    } else {
      console.log(`✅ RPC '${rpc.name}': WORKS`);
    }
  }
}

run();
