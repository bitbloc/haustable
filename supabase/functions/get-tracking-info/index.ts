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
      token = typeof body.token === 'string' ? body.token.trim() : body.token;
    } catch {
      throw new Error("Invalid request body");
    }

    const TOKEN_REGEX = /^[a-zA-Z0-9_-]{4,64}$/;

    if (!token || token === "null" || token === "undefined" || !TOKEN_REGEX.test(token)) {
      return new Response(JSON.stringify({ error: "ข้อมูลไม่ถูกต้อง (Invalid Token)", code: "INVALID_TOKEN" }), {
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
        promotion_codes ( code ),
        profiles ( display_name ),
        order_items (
          quantity,
          price_at_time,
          custom_name,
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

    // 2. Validate Expiry (Only if token_expires_at is set and valid)
    if (booking.token_expires_at) {
      const now = new Date();
      const expiresAt = new Date(booking.token_expires_at);

      if (!isNaN(expiresAt.getTime()) && now > expiresAt) {
        console.warn(`[Tracking] Token expired for ID: ${booking.id}`);
        return new Response(JSON.stringify({ error: "ลิงก์นี้หมดอายุแล้ว (Link Expired)", code: "TOKEN_EXPIRED" }), {
          status: 410, // Gone
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Data Masking & Safe Response Construction
    const fullName = booking.pickup_contact_name || booking.profiles?.display_name || booking.customer_name || "Guest";
    const safeName = fullName.split(" ")[0]; // Only show first name

    // Mask Phone: 081-234-5678 -> 081-xxx-5678
    let maskedPhone = "";
    const rawPhone = booking.pickup_contact_phone || booking.phone || booking.profiles?.phone_number || "";
    if (rawPhone) {
      const p = rawPhone.replace(/[^0-9]/g, ""); 
      if (p.length >= 10) {
        maskedPhone = `${p.substring(0, 3)}-xxx-${p.substring(p.length - 4)}`;
      } else {
        maskedPhone = rawPhone;
      }
    }

    // Generate Short ID (Last 4 of token, uppercase)
    const shortId = token.slice(-4).toUpperCase();

    // Simplify Items
    const items = booking.order_items?.map((item: any) => ({
      name: item.custom_name || item.menu_items?.name || "Unknown Item",
      quantity: item.quantity,
      price: item.price_at_time,
      options: item.selected_options
    })) || [];

    const responseData = {
      id: booking.id,
      short_id: shortId,
      status: booking.status,
      booking_type: booking.booking_type || 'dine_in',
      order_type: booking.order_type || (booking.booking_type === 'hausmade' ? (booking.shipping_address ? 'hausmade_shipping' : 'hausmade_pickup') : null),
      customer_name: safeName,
      full_name: fullName,
      phone: maskedPhone,
      pickup_contact_name: booking.pickup_contact_name,
      pickup_contact_phone: booking.pickup_contact_phone,
      shipping_address: booking.shipping_address,
      shipping_fee: booking.shipping_fee,
      courier_name: booking.courier_name || 'Flash Express',
      tracking_number: booking.tracking_number,
      customer_note: booking.customer_note,
      staff_remark: booking.staff_remark,
      is_preorder: booking.is_preorder,
      preorder_eta: booking.preorder_eta,
      created_at: booking.created_at,
      booking_time: booking.booking_time,
      pax: booking.pax,
      items: items,
      table_name: booking.tables_layout?.table_name,
      total_amount: booking.total_amount,
      discount_amount: booking.discount_amount,
      promotion_codes: booking.promotion_codes,
      profiles: booking.profiles,
      payment_slip_url: booking.payment_slip_url,
      slip_verified: booking.slip_verified,
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
