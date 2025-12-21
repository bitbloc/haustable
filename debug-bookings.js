
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
    console.log("Checking latest 5 PICKUP bookings...")
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, booking_type, payment_slip_url, status')
        .eq('booking_type', 'pickup')
        .order('created_at', { ascending: false })
        .limit(5)

    if (error) {
        console.error("Error fetching bookings:", error)
        return
    }

    console.table(bookings)
}

checkBookings()
