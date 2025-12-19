import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase Environment Variables");
    }

    // Initialize Supabase Client with Service Role Key (Bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get token from request body
    const { token } = await req.json();

    if (!token) {
      throw new Error("Token is required");
    }

    // 1. Query Booking with Items and Menu Details
    // We select order_items and nested menu_items to get names
    const { data: booking, error: dbError } = await supabase
      .from("bookings")
      .select(`
        *,
        order_items (
          quantity,
          price_at_time,
          selected_options,
          menu_items (
            name,
            image_url
          )
        )
      `)
      .eq("tracking_token", token)
      .single();

    if (dbError || !booking) {
      if (dbError) console.error("Database Error:", dbError);
      return new Response(JSON.stringify({ error: "Booking not found", code: "NOT_FOUND" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validate Expiry
    // Rules:
    // - Token allows access from creation time.
    // - Expires STRICTLY after token_expires_at (usually booking_time + 24h).
    const now = new Date();
    const expiresAt = new Date(booking.token_expires_at);

    if (now > expiresAt) {
      return new Response(JSON.stringify({ error: "Link has expired", code: "TOKEN_EXPIRED" }), {
        status: 400, // Or 410 Gone
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Data Masking & Transformation
    
    // Name: First word only
    const fullName = booking.customer_name || "Customer";
    const displayName = booking.user_id ? fullName : fullName.split(" ")[0]; // If registered user (maybe), show full? No, keep safe.
    // User requested "Customer changed to System Name". If we have user_id, maybe we can fetch profile, but booking.customer_name should be the name formatted at booking time.
    // Let's stick to the requested "System Name" or safe first name.
    const safeName = fullName.split(" ")[0]; 

    // Phone: 08X-XXX-1234
    let maskedPhone = "";
    if (booking.phone) {
      const p = booking.phone.replace(/[^0-9]/g, ""); 
      if (p.length >= 10) {
        maskedPhone = `${p.substring(0, 3)}-xxx-${p.substring(p.length - 4)}`;
      } else {
        maskedPhone = "xxx-xxx-xxxx";
      }
    }

    // Short ID (for humans)
    // If no specific short_id column, we use the last 4 chars of the UUID or ID.
    // Assuming 'id' is integer, we can use that if it's safe? or just hash.
    // Booking ID is usually safe to show partial.
    // Let's use the last 4 of tracking_token (it's random UUID) usually HEX.
    // Better: Generate a simple Hash or use ID if non-sequential. 
    // Let's use last 4 chars of Token upper-cased for now as "Order Code".
    const shortId = token.slice(-4).toUpperCase();

    // Map Items to simpler structure
    const items = booking.order_items?.map((item: any) => ({
      name: item.menu_items?.name || "Unknown Item",
      quantity: item.quantity,
      price: item.price_at_time,
      options: item.selected_options
    })) || [];

    // Construct Safe Response
    const safeData = {
      booking_id: booking.id, // Internal ID (maybe useful)
      short_id: shortId,
      status: booking.status,
      booking_type: booking.booking_type || 'dine_in', // default to dine_in
      customer_name: safeName,
      phone: maskedPhone,
      booking_time: booking.booking_time,
      pax: booking.pax,
      items: items,
      table_id: booking.table_id,
      customer_note: booking.customer_note,
      total_amount: booking.total_amount,
      token_expires_at: booking.token_expires_at
    };

    return new Response(JSON.stringify(safeData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message, code: "INTERNAL_ERROR" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
