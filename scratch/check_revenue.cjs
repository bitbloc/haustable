const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_KEY=(.*)/)[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRevenue() {
    const today = '2026-09-04';
    // Let's count how many bookings have booking_time today vs updated_at today
    const { data: byBookingTime, error: e1 } = await supabase
        .from('bookings')
        .select('id, total_amount, booking_time, created_at, updated_at, status')
        .gte('booking_time', `${today}T00:00:00+07:00`)
        .lte('booking_time', `${today}T23:59:59+07:00`);

    console.log("Bookings with booking_time TODAY:", byBookingTime ? byBookingTime.length : 0);
    const sumToday = (byBookingTime || []).reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    console.log("Total amount by booking_time TODAY: ฿", sumToday);

    const { data: allWithUpdatedAtToday } = await supabase
        .from('bookings')
        .select('id, total_amount, booking_time, updated_at')
        .gte('updated_at', `${today}T00:00:00+07:00`);

    console.log("Bookings with updated_at TODAY:", allWithUpdatedAtToday ? allWithUpdatedAtToday.length : 0);
    const sumUpdated = (allWithUpdatedAtToday || []).reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    console.log("Total amount by updated_at TODAY: ฿", sumUpdated);
}

checkRevenue();
