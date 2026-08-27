const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lxfavbzmebqqsffgyyph.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI');

async function main() {
  const start = '2026-08-27T00:00:00+07:00';
  const end = '2026-08-27T23:59:59+07:00';
  const { data, error } = await supabase
    .from('bookings')
    .select('id, status, total_amount, booking_time, updated_at, staff_remark')
    .gte('booking_time', start)
    .lte('booking_time', end);

  console.log('Today bookings count:', data ? data.length : 0);
  console.log('Today bookings:', JSON.stringify(data, null, 2));
}

main();
