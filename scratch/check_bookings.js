import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBookings() {
    const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2);

    if (error) {
        console.error('Error fetching bookings:', error);
        return;
    }

    console.log('Recent 15 bookings:');
    console.log(JSON.stringify(data, null, 2));
}

checkBookings();
