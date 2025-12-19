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

    // Query Booking by tracking_token
    const { data: booking, error: dbError } = await supabase
      .from("bookings")
      .select("*")
      .eq("tracking_token", token)
      .single();

    if (dbError || !booking) {
      if (dbError) console.error("Database Error:", dbError);
      return new Response(JSON.stringify({ error: "Booking not found or invalid token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate Expiry
    const now = new Date();
    const expiresAt = new Date(booking.token_expires_at);

    if (now > expiresAt) {
      return new Response(JSON.stringify({ error: "Link has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Data Masking logic
    // 1. Name: First word only
    const fullName = booking.customer_name || "Customer";
    const displayName = fullName.split(" ")[0];

    // 2. Phone: 08X-XXX-1234
    let maskedPhone = "";
    if (booking.phone) {
      // Simple regex to keep last 4 digits and first 2-3, mask the middle
      // Or strictly follow 08X-XXX-1234 style if standard thai number
      // User request: 081-xxx-1234
      const p = booking.phone.replace(/[^0-9]/g, ""); // clean non-digits
      if (p.length >= 10) {
        maskedPhone = `${p.substring(0, 3)}-xxx-${p.substring(p.length - 4)}`;
      } else {
        maskedPhone = "xxx-xxx-xxxx";
      }
    }

    // Construct Safe Response
    const safeData = {
      status: booking.status,
      customer_name: displayName,
      phone: maskedPhone,
      booking_time: booking.booking_time,
      pax: booking.pax,
      items: booking.items, // Assuming items is JSONB or similar
      table_id: booking.table_id, // Maybe safe to show?
      customer_note: booking.customer_note, // Be careful, but usually okay
    };

    return new Response(JSON.stringify(safeData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
