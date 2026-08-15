const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync(".env", "utf8");
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase
        .from("bookings")
        .select(`id, tracking_token, booking_time, booking_type, pickup_contact_name, customer_note, status`)
        .order("booking_time", { ascending: false })
        .limit(10);
        
    console.log("Error:", error);
    console.log("Recent Bookings:", data?.map(b => ({
        id: b.id,
        tracking_token: b.tracking_token,
        id_last4: b.id ? b.id.replace(/-/g, '').slice(-4).toUpperCase() : null,
        token_last4: b.tracking_token ? b.tracking_token.slice(-4).toUpperCase() : null,
        status: b.status,
        name: b.pickup_contact_name || b.customer_note
    })));
}
test();
