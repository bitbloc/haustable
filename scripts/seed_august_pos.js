import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

// All rows from the Tax Sale Report August 2026 PDF (1 - 17 August 2026)
const rawRowsAugust = [
  // Page 1
  { date: '2026-08-01', inv: 'ก/00004201 - ก/00004222', amount: 15222.00 },
  { date: '2026-08-01', inv: 'INTHEHAUS/00005372 - INTHEHAUS/00005374', amount: 480.00 },
  { date: '2026-08-02', inv: 'ก/00004223 - ก/00004241', amount: 7563.00 },
  { date: '2026-08-02', inv: 'INTHEHAUS/00005375 - INTHEHAUS/00005378', amount: 1167.20 },
  { date: '2026-08-04', inv: 'ก/00004243 - ก/00004252', amount: 8306.00 },
  { date: '2026-08-04', inv: 'INTHEHAUS/00005379 - INTHEHAUS/00005382', amount: 856.00 },
  { date: '2026-08-05', inv: 'ก/00004253 - ก/00004258', amount: 2437.00 },
  { date: '2026-08-05', inv: 'INTHEHAUS/00005383 - INTHEHAUS/00005384', amount: 338.00 },
  { date: '2026-08-06', inv: 'ก/00004259 - ก/00004268', amount: 7488.00 },
  { date: '2026-08-06', inv: 'INTHEHAUS/00005385 - INTHEHAUS/00005387', amount: 1122.80 },
  { date: '2026-08-07', inv: 'ก/00004269 - ก/00004282', amount: 7574.00 },
  { date: '2026-08-07', inv: 'INTHEHAUS/00005388 - INTHEHAUS/00005388', amount: 159.00 },
  { date: '2026-08-08', inv: 'ก/00004283 - ก/00004303', amount: 15895.00 },
  { date: '2026-08-08', inv: 'INTHEHAUS/00005389 - INTHEHAUS/00005392', amount: 1401.10 },
  { date: '2026-08-09', inv: 'ก/00004304 - ก/00004321', amount: 13011.00 },
  { date: '2026-08-09', inv: 'INTHEHAUS/00005394 - INTHEHAUS/00005394', amount: 275.00 },
  { date: '2026-08-10', inv: 'ก/00004322 - ก/00004338', amount: 10384.40 },
  { date: '2026-08-10', inv: 'INTHEHAUS/00005395 - INTHEHAUS/00005398', amount: 931.60 },
  { date: '2026-08-11', inv: 'ก/00004339 - ก/00004360', amount: 17627.40 },
  { date: '2026-08-11', inv: 'INTHEHAUS/00005399 - INTHEHAUS/00005400', amount: 308.00 },
  { date: '2026-08-12', inv: 'ก/00004361 - ก/00004376', amount: 9091.00 },
  { date: '2026-08-12', inv: 'INTHEHAUS/00005401 - INTHEHAUS/00005401', amount: 159.00 },
  { date: '2026-08-13', inv: 'ก/00004377 - ก/00004389', amount: 5029.00 },
  { date: '2026-08-13', inv: 'INTHEHAUS/00005402 - INTHEHAUS/00005405', amount: 771.00 },
  { date: '2026-08-14', inv: 'ก/00004390 - ก/00004400', amount: 10156.00 },

  // Page 2
  { date: '2026-08-14', inv: 'INTHEHAUS/00005406 - INTHEHAUS/00005408', amount: 431.00 },
  { date: '2026-08-15', inv: 'ก/00004401 - ก/00004418', amount: 11861.00 },
  { date: '2026-08-15', inv: 'INTHEHAUS/00005409 - INTHEHAUS/00005413', amount: 1286.50 },
  { date: '2026-08-16', inv: 'ก/00004419 - ก/00004437', amount: 11967.00 },
  { date: '2026-08-16', inv: 'INTHEHAUS/00005414 - INTHEHAUS/00005414', amount: 129.00 },
  { date: '2026-08-17', inv: 'ก/00004438 - ก/00004448', amount: 6768.00 },
  { date: '2026-08-17', inv: 'INTHEHAUS/00005415 - INTHEHAUS/00005416', amount: 1123.80 },
];

const totalSumAugust = rawRowsAugust.reduce((s, r) => s + r.amount, 0);
console.log(`Total August Rows: ${rawRowsAugust.length}`);
console.log(`Calculated August Grand Total: ${totalSumAugust.toFixed(2)} (Expected: 171318.80)`);

async function runSeedAugust() {
  console.log('Inserting Daily POS Historical Bookings for August 2026...');
  const bookingsToInsert = rawRowsAugust.map((row) => ({
    booking_time: `${row.date}T18:00:00.000Z`,
    created_at: `${row.date}T18:00:00.000Z`,
    status: 'completed',
    total_amount: row.amount,
    deposit_amount: row.amount,
    booking_type: row.inv.includes('INTHEHAUS') ? 'dine_in' : 'pickup',
    staff_remark: `POS เก่า (POS ID: H1, บิล: ${row.inv})`,
    pickup_contact_name: 'Sale summary report (POS เก่า August)',
    pax: 1
  }));

  // Batch insert into bookings in chunks of 50
  for (let i = 0; i < bookingsToInsert.length; i += 50) {
    const chunk = bookingsToInsert.slice(i, i + 50);
    const { data: bData, error: bErr } = await supabase.from('bookings').insert(chunk).select('id');
    if (bErr) {
      console.error(`bookings insert error at chunk ${i}:`, bErr);
    } else {
      console.log(`✓ Inserted August bookings chunk ${i + 1} - ${i + chunk.length}`);
    }
  }

  console.log('✅ ALL AUGUST HISTORICAL DATA SEEDED SUCCESSFULLY!');
}

runSeedAugust();
