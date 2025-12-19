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
      throw new Error("Missing Supabase configuration");
    }

    // Initialize Supabase Client (Service Role for admin access)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse Request Body
    let token;
    try {
      const body = await req.json();
      token = body.token;
    } catch {
      throw new Error("Invalid request body");
    }

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required", code: "MISSING_TOKEN" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Tracking] Fetching info for token: ${token.slice(0, 8)}...`);

    // 1. Query Booking
    const { data: booking, error: dbError } = await supabase
      .from("bookings")
      .select(`
        *,
        tables_layout ( table_name ),
        order_items (
          quantity,
          price_at_time,
          selected_options,
          menu_items ( name, image_url )
        )
      `)
      .eq("tracking_token", token)
      .single();

    if (dbError || !booking) {
      console.error("[Tracking] Token match failed or DB error:", dbError);
      return new Response(JSON.stringify({ error: "ข้อมูลไม่ถูกต้อง หรือรายการถูกลบไปแล้ว", code: "NOT_FOUND" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validate Expiry
    const now = new Date();
    const expiresAt = new Date(booking.token_expires_at);

    if (now > expiresAt) {
      console.warn(`[Tracking] Token expired for ID: ${booking.id}`);
      return new Response(JSON.stringify({ error: "ลิงก์นี้หมดอายุแล้ว (Link Expired)", code: "TOKEN_EXPIRED" }), {
        status: 410, // Gone
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Data Masking & Safe Response Construction
    const fullName = booking.customer_name || "Guest";
    const safeName = fullName.split(" ")[0]; // Only show first name

    // Mask Phone: 081-234-5678 -> 081-xxx-5678
    let maskedPhone = "";
    if (booking.phone) {
      const p = booking.phone.replace(/[^0-9]/g, ""); 
      if (p.length >= 10) {
        maskedPhone = `${p.substring(0, 3)}-xxx-${p.substring(p.length - 4)}`;
      } else {
        maskedPhone = "xxx-xxxx";
      }
    }

    // Generate Short ID (Last 4 of token, uppercase)
    const shortId = token.slice(-4).toUpperCase();

    // Simplify Items
    const items = booking.order_items?.map((item: any) => ({
      name: item.menu_items?.name || "Unknown Item",
      quantity: item.quantity,
      price: item.price_at_time,
      options: item.selected_options
    })) || [];

    const responseData = {
      short_id: shortId,
      status: booking.status,
      booking_type: booking.booking_type || 'dine_in',
      customer_name: safeName,
      phone: maskedPhone,
      booking_time: booking.booking_time,
      pax: booking.pax,
      items: items,
      table_name: booking.tables_layout?.table_name,
      total_amount: booking.total_amount,
      token_expires_at: booking.token_expires_at
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error(`[Tracking] Internal Error: ${error.message}`);
    return new Response(JSON.stringify({ error: "Internal Server Error", code: "INTERNAL_ERROR" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
