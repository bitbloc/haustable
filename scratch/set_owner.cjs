require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function setOwner() {
  console.log("Searching for profiles matching 'banff'...");
  
  // 1. Fetch all profiles to find banff
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, display_name, nickname, role, line_user_id, phone_number');

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  const matching = profiles.filter(p => {
    const d = (p.display_name || '').toLowerCase();
    const n = (p.nickname || '').toLowerCase();
    const l = (p.line_user_id || '').toLowerCase();
    const id = (p.id || '').toLowerCase();
    return d.includes('banff') || n.includes('banff') || l.includes('banff') || id.includes('banff');
  });

  console.log("Found matches:", matching);

  if (matching.length === 0) {
    console.log("No exact match for 'banff'. Listing all profiles:");
    console.log(profiles.map(p => ({ id: p.id, name: p.display_name, nick: p.nickname, role: p.role, line_id: p.line_user_id })));
    return;
  }

  for (const user of matching) {
    console.log(`Updating ${user.display_name} (${user.id}) to role 'owner'...`);
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'owner'
      })
      .eq('id', user.id)
      .select();

    if (updateError) {
      console.error(`Failed to update ${user.id}:`, updateError);
    } else {
      console.log(`✅ Successfully updated ${user.display_name} (${user.id}) to role 'owner'!`);
      console.log("Updated data:", data);
    }
  }
}

setOwner();
