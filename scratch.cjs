const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_KEY
);

async function checkRecentOrder() {
  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select('id, user_id, status, total_amount, discount_amount, xhaus_earned, xhaus_redeemed, xhaus_discount, staff_remark, created_at, created_at')
    .eq('status', 'completed')
    
    .order('created_at', { ascending: false })
    .limit(3);
    
  if (bErr) {
    console.error('Error fetching bookings:', bErr);
    return;
  }
  
  console.log('Recent Completed Bookings with User:', JSON.stringify(bookings, null, 2));

  if (bookings && bookings.length > 0) {
    const userIds = [...new Set(bookings.map(b => b.user_id))];
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name, xhaus_balance, total_earned_xhaus, total_redeemed_xhaus, drink_stamp_count, free_drink_quota')
      .in('id', userIds);
      
    if (pErr) {
      console.error('Error fetching profiles:', pErr);
      return;
    }
    
    console.log('Associated Profiles:', JSON.stringify(profiles, null, 2));
  }
}

checkRecentOrder();
