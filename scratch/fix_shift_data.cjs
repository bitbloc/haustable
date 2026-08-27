const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lxfavbzmebqqsffgyyph.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI');

async function fix() {
  console.log('--- FIXING POS SHIFT DATA IN CLOUD ---');

  // 1. Close the old August 13-15 zombie shift with its original data
  const oldShiftUpdate = {
    status: 'closed',
    closed_at: '2026-08-15T16:00:00.000Z',
    closed_cash: 5504,
    expected_cash: 5504,
    difference: 0,
    total_in: 150,
    total_out: 50,
    adjustments: [
      {
        id: 'adj_1786797220399',
        note: 'แมว',
        type: 'out',
        amount: 50,
        timestamp: '2026-08-15T12:33:40.399Z'
      },
      {
        id: 'adj_1786797238329',
        note: 'cat sing',
        type: 'in',
        amount: 150,
        timestamp: '2026-08-15T12:33:58.329Z'
      }
    ]
  };

  const { error: oldErr } = await supabase
    .from('pos_shifts')
    .update(oldShiftUpdate)
    .eq('id', 'shift_1786604942049');

  if (oldErr) {
    console.error('Error closing old shift:', oldErr);
  } else {
    console.log('✅ Successfully closed old zombie shift (shift_1786604942049) and restored Aug 15 history.');
  }

  // 2. Close any other lingering open shifts in cloud
  const { error: closeAllErr } = await supabase
    .from('pos_shifts')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('status', 'open');

  if (closeAllErr) {
    console.warn('Error closing open shifts:', closeAllErr);
  }

  // 3. Create a clean, accurate active shift for TODAY (2026-08-27)
  const todayShift = {
    id: 'shift_1787799840912',
    staff_name: 'Kanchanit Boonsuk',
    opened_at: '2026-08-27T03:00:00.000Z',
    closed_at: null,
    status: 'open',
    opening_float: 5484,
    closed_cash: 0,
    expected_cash: 5354, // 5484 - 100 - 30
    difference: 0,
    cash_sales: 0,
    qr_sales: 0,
    credit_sales: 0,
    total_sales: 0,
    total_in: 0,
    total_out: 130,
    transactions: [],
    adjustments: [
      {
        id: 'adj_1787799950335',
        note: 'น้ำแข็ง',
        type: 'out',
        amount: 100,
        timestamp: '2026-08-27T03:05:50.335Z'
      },
      {
        id: 'adj_1787802325353',
        note: 'ผัก/ดอกไม้',
        type: 'out',
        amount: 30,
        timestamp: '2026-08-27T03:45:25.354Z'
      }
    ]
  };

  const { error: insertErr } = await supabase
    .from('pos_shifts')
    .upsert(todayShift);

  if (insertErr) {
    console.error('Error creating today shift:', insertErr);
  } else {
    console.log('✅ Successfully created clean active shift for today (27/08/2026):');
    console.log('   - Staff:', todayShift.staff_name);
    console.log('   - Opened At:', todayShift.opened_at);
    console.log('   - Opening Float: ฿' + todayShift.opening_float);
    console.log('   - Total In: ฿' + todayShift.total_in);
    console.log('   - Total Out: ฿' + todayShift.total_out + ' (น้ำแข็ง 100 + ผัก/ดอกไม้ 30)');
    console.log('   - Expected Cash in Drawer: ฿' + todayShift.expected_cash);
  }
}

fix();
