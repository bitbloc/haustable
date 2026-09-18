import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

const getBangkokHour = (timeInput) => {
    if (!timeInput) return -1;
    try {
        const d = new Date(timeInput);
        const str = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour12: false, hour: '2-digit' });
        return parseInt(str, 10);
    } catch {
        return new Date(timeInput).getHours();
    }
};

async function test() {
    const today = '2026-09-18';
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
            *,
            order_items ( quantity, price_at_time, menu_items(name, price) )
        `)
        .or(`and(booking_time.gte.${today}T00:00:00+07:00,booking_time.lte.${today}T23:59:59+07:00),and(created_at.gte.${today}T00:00:00+07:00,created_at.lte.${today}T23:59:59+07:00)`);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${bookings.length} bookings for ${today}`);

    const hours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const hourlySales = {};
    hours.forEach(h => hourlySales[h] = 0);

    bookings.forEach(b => {
        const timeStr = b.booking_time || b.created_at;
        const h = getBangkokHour(timeStr);
        let billAmt = Number(b.total_amount || b.total_price || b.deposit_amount || 0);
        if (!billAmt && b.order_items && b.order_items.length > 0) {
            billAmt = b.order_items.reduce((s, it) => s + (Number(it.price_at_time || it.menu_items?.price || 0) * (it.quantity || 1)), 0);
        }
        console.log(`- Booking #${b.id.slice(0, 6)}: status=${b.status}, time=${timeStr}, BangkokHour=${h}, billAmt=฿${billAmt}`);
        if (hourlySales[h] !== undefined) {
            hourlySales[h] += billAmt;
        }
    });

    console.log('Hourly sales:', hourlySales);
}

test();
