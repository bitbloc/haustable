import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

// All rows from the Tax Sale Report July 2026 PDF
const rawRowsJuly = [
  // Page 1
  { date: '2026-07-01', inv: 'ก/00003697 - ก/00003708', amount: 5236.00 },
  { date: '2026-07-01', inv: 'INTHEHAUS/00005271 - INTHEHAUS/00005278', amount: 2224.80 },
  { date: '2026-07-02', inv: 'ก/00003709 - ก/00003721', amount: 7244.00 },
  { date: '2026-07-02', inv: 'INTHEHAUS/00005279 - INTHEHAUS/00005280', amount: 323.00 },
  { date: '2026-07-03', inv: 'ก/00003722 - ก/00003734', amount: 8191.00 },
  { date: '2026-07-03', inv: 'INTHEHAUS/00005281 - INTHEHAUS/00005286', amount: 1164.00 },
  { date: '2026-07-04', inv: 'ก/00003735 - ก/00003749', amount: 11294.00 },
  { date: '2026-07-04', inv: 'INTHEHAUS/00005287 - INTHEHAUS/00005290', amount: 896.00 },
  { date: '2026-07-05', inv: 'ก/00003750 - ก/00003761', amount: 7311.00 },
  { date: '2026-07-05', inv: 'INTHEHAUS/00005292 - INTHEHAUS/00005297', amount: 1038.00 },
  { date: '2026-07-06', inv: 'ก/00003762 - ก/00003773', amount: 7118.00 },
  { date: '2026-07-06', inv: 'INTHEHAUS/00005298 - INTHEHAUS/00005299', amount: 479.20 },
  { date: '2026-07-07', inv: 'ก/00003774 - ก/00003785', amount: 8899.00 },
  { date: '2026-07-07', inv: 'INTHEHAUS/00005300 - INTHEHAUS/00005303', amount: 697.00 },
  { date: '2026-07-08', inv: 'ก/00003786 - ก/00003800', amount: 7978.00 },
  { date: '2026-07-08', inv: 'INTHEHAUS/00005304 - INTHEHAUS/00005304', amount: 323.00 },
  { date: '2026-07-09', inv: 'ก/00003801 - ก/00003815', amount: 12176.00 },
  { date: '2026-07-09', inv: 'INTHEHAUS/00005305 - INTHEHAUS/00005309', amount: 1021.20 },
  { date: '2026-07-10', inv: 'ก/00003816 - ก/00003826', amount: 6233.00 },
  { date: '2026-07-10', inv: 'INTHEHAUS/00005310 - INTHEHAUS/00005313', amount: 1733.60 },
  { date: '2026-07-11', inv: 'ก/00003827 - ก/00003841', amount: 9525.00 },
  { date: '2026-07-11', inv: 'INTHEHAUS/00005314 - INTHEHAUS/00005319', amount: 1014.00 },
  { date: '2026-07-12', inv: 'ก/00003842 - ก/00003856', amount: 8465.00 },
  { date: '2026-07-12', inv: 'INTHEHAUS/00005320 - INTHEHAUS/00005321', amount: 525.30 },
  { date: '2026-07-13', inv: 'ก/00003857 - ก/00003868', amount: 3736.00 },

  // Page 2
  { date: '2026-07-13', inv: 'INTHEHAUS/00005322 - INTHEHAUS/00005323', amount: 1513.70 },
  { date: '2026-07-14', inv: 'ก/00003869 - ก/00003884', amount: 8145.15 },
  { date: '2026-07-14', inv: 'INTHEHAUS/00005324 - INTHEHAUS/00005326', amount: 467.00 },
  { date: '2026-07-15', inv: 'ก/00003885 - ก/00003892', amount: 2985.00 },
  { date: '2026-07-15', inv: 'INTHEHAUS/00005327 - INTHEHAUS/00005327', amount: 129.00 },
  { date: '2026-07-16', inv: 'ก/00003893 - ก/00003912', amount: 11733.00 },
  { date: '2026-07-16', inv: 'INTHEHAUS/00005328 - INTHEHAUS/00005329', amount: 501.00 },
  { date: '2026-07-17', inv: 'ก/00003913 - ก/00003927', amount: 9906.95 },
  { date: '2026-07-17', inv: 'INTHEHAUS/00005331 - INTHEHAUS/00005333', amount: 757.50 },
  { date: '2026-07-18', inv: 'ก/00003928 - ก/00003946', amount: 12823.00 },
  { date: '2026-07-18', inv: 'INTHEHAUS/00005334 - INTHEHAUS/00005335', amount: 325.00 },
  { date: '2026-07-19', inv: 'ก/00003947 - ก/00003966', amount: 10391.00 },
  { date: '2026-07-19', inv: 'INTHEHAUS/00005336 - INTHEHAUS/00005340', amount: 1228.00 },
  { date: '2026-07-20', inv: 'ก/00003968 - ก/00003983', amount: 9795.00 },
  { date: '2026-07-20', inv: 'INTHEHAUS/00005341 - INTHEHAUS/00005344', amount: 1221.50 },
  { date: '2026-07-21', inv: 'ก/00003985 - ก/00004002', amount: 8990.05 },
  { date: '2026-07-21', inv: 'INTHEHAUS/00005345 - INTHEHAUS/00005347', amount: 616.00 },
  { date: '2026-07-22', inv: 'ก/00004003 - ก/00004016', amount: 9406.00 },
  { date: '2026-07-22', inv: 'INTHEHAUS/00005348 - INTHEHAUS/00005349', amount: 396.00 },
  { date: '2026-07-23', inv: 'ก/00004017 - ก/00004029', amount: 12282.00 },
  { date: '2026-07-23', inv: 'INTHEHAUS/00005350 - INTHEHAUS/00005352', amount: 567.00 },
  { date: '2026-07-24', inv: 'ก/00004030 - ก/00004042', amount: 5416.00 },
  { date: '2026-07-24', inv: 'INTHEHAUS/00005353 - INTHEHAUS/00005353', amount: 129.00 },
  { date: '2026-07-25', inv: 'ก/00004043 - ก/00004068', amount: 13421.90 },
  { date: '2026-07-25', inv: 'INTHEHAUS/00005354 - INTHEHAUS/00005355', amount: 274.00 },
  { date: '2026-07-26', inv: 'ก/00004069 - ก/00004084', amount: 6739.00 },
  { date: '2026-07-26', inv: 'INTHEHAUS/00005356 - INTHEHAUS/00005359', amount: 791.00 },
  { date: '2026-07-27', inv: 'ก/00004085 - ก/00004108', amount: 21813.70 },
  { date: '2026-07-27', inv: 'INTHEHAUS/00005360 - INTHEHAUS/00005360', amount: 366.30 },
  { date: '2026-07-28', inv: 'ก/00004109 - ก/00004135', amount: 19046.00 },
  { date: '2026-07-28', inv: 'INTHEHAUS/00005361 - INTHEHAUS/00005361', amount: 258.00 },
  { date: '2026-07-29', inv: 'ก/00004136 - ก/00004156', amount: 12070.00 },
  { date: '2026-07-29', inv: 'INTHEHAUS/00005362 - INTHEHAUS/00005362', amount: 299.00 },

  // Page 3
  { date: '2026-07-30', inv: 'ก/00004157 - ก/00004178', amount: 11629.00 },
  { date: '2026-07-30', inv: 'INTHEHAUS/00005363 - INTHEHAUS/00005365', amount: 558.50 },
  { date: '2026-07-31', inv: 'ก/00004179 - ก/00004200', amount: 13465.00 },
  { date: '2026-07-31', inv: 'INTHEHAUS/00005366 - INTHEHAUS/00005371', amount: 1847.10 },
];

const totalSumJuly = rawRowsJuly.reduce((s, r) => s + r.amount, 0);
console.log(`Total July Rows: ${rawRowsJuly.length}`);
console.log(`Calculated July Grand Total: ${totalSumJuly.toFixed(2)} (Expected: 327147.45)`);

async function runSeedJuly() {
  console.log('Inserting Daily POS Historical Bookings for July 2026...');
  const bookingsToInsert = rawRowsJuly.map((row) => ({
    booking_time: `${row.date}T18:00:00.000Z`,
    created_at: `${row.date}T18:00:00.000Z`,
    status: 'completed',
    total_amount: row.amount,
    deposit_amount: row.amount,
    booking_type: row.inv.includes('INTHEHAUS') ? 'dine_in' : 'pickup',
    staff_remark: `POS เก่า (POS ID: H1, บิล: ${row.inv})`,
    pickup_contact_name: 'Sale summary report (POS เก่า July)',
    pax: 1
  }));

  // Batch insert into bookings in chunks of 50
  for (let i = 0; i < bookingsToInsert.length; i += 50) {
    const chunk = bookingsToInsert.slice(i, i + 50);
    const { data: bData, error: bErr } = await supabase.from('bookings').insert(chunk).select('id');
    if (bErr) {
      console.error(`bookings insert error at chunk ${i}:`, bErr);
    } else {
      console.log(`✓ Inserted July bookings chunk ${i + 1} - ${i + chunk.length}`);
    }
  }

  console.log('✅ ALL JULY HISTORICAL DATA SEEDED SUCCESSFULLY!');
}

runSeedJuly();
