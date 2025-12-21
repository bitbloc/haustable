
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Try to read .env
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_KEY // Usually ANON key is enough for SELECT if RLS allows public read or if we use service role

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_KEY in .env")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)


async function checkBookings() {
    // Latest token from previous step
    const testToken = '38052b32-8e74-4724-9614-09269f225890' 

    console.log(`Testing query for token: ${testToken}`)

    const { data: booking, error } = await supabase
      .from("bookings")
      .select(`
        *,
        tables_layout ( table_name ),
        promotion_codes ( code ),
        profiles ( display_name, first_name, last_name ),
        order_items (
          quantity,
          price_at_time,
          selected_options,
          menu_items ( name, image_url )
        )
      `)
      .eq("tracking_token", testToken)
      .single()

    if (error) {
        console.error("Query Failed:", error)
    } else {
        console.log("Query Successful!")
        console.log("Status:", booking.status)
        console.log("Expiry:", booking.token_expires_at)
        console.log("Table:", booking.tables_layout)
        console.log("Items:", booking.order_items?.length)
    }
}

checkBookings()
