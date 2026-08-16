const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function check() {
    const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select('*, order_items(*)')
        .eq('id', '9dad2f93-5c42-4277-aee8-519195b4046c')
        .single();

    if (bErr) {
        console.error('Error fetching booking:', bErr);
        return;
    }

    console.log('✅ Fetched Created LINE MAN Booking:');
    console.log('Booking:', {
        id: booking.id,
        pickup_contact_name: booking.pickup_contact_name,
        pickup_contact_phone: booking.pickup_contact_phone,
        staff_remark: booking.staff_remark,
        total_amount: booking.total_amount,
        status: booking.status,
        tracking_token: booking.tracking_token
    });
    console.log('Order Items count:', booking.order_items.length);
    console.log('Order Items:', booking.order_items);
}

check();
