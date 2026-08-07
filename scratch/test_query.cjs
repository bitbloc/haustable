const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync(".env", "utf8");
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const startIso = "2026-08-01T00:00:00";
    const endIso = "2026-08-31T23:59:59";
    const { data: rangeData, error: rangeErr } = await supabase
        .from("bookings")
        .select(`
            id, tracking_token, booking_time, total_amount, total_price, discount_amount,
            status, pax, number_of_guests, booking_type, payment_slip_url, staff_remark,
            customer_name, customer_note, pickup_contact_name, pickup_contact_phone, user_id,
            profiles ( id, display_name, phone, line_user_id ),
            tables_layout ( table_name ),
            order_items ( id, quantity, price_at_time, special_instructions, selected_options, menu_items ( id, name, price, menu_categories ( name ) ) )
        `)
        .gte("booking_time", startIso)
        .lte("booking_time", endIso)
        .order("booking_time", { ascending: false });
        
    console.log("rangeErr:", rangeErr);
    console.log("rangeData length:", rangeData ? rangeData.length : null);
}
test();
